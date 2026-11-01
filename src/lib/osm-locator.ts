import type { MinimartStoreUpsert } from "@/lib/minimart-locator";

/** Public Overpass endpoint (OSM). */
export const OSM_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const OSM_ATTRIBUTION = "https://www.openstreetmap.org/copyright";

/** Bulgaria mainland + nearby bounds for tiled Overpass queries. */
export const BULGARIA_BBOX = {
  south: 41.2,
  west: 22.35,
  north: 44.25,
  east: 28.7,
} as const;

/** Shop / amenity tags that usually mean small retail / kiosk. */
export const OSM_RETAIL_TAG_FILTERS = [
  '["amenity"="kiosk"]',
  '["shop"="kiosk"]',
  '["shop"="convenience"]',
  '["shop"="greengrocer"]',
  '["shop"="newsagent"]',
  '["shop"="general"]',
] as const;

type OsmTags = Record<string, string | undefined>;

export type OsmOverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

export type OsmOverpassResponse = {
  elements?: OsmOverpassElement[];
};

export function osmExternalId(
  type: OsmOverpassElement["type"],
  id: number,
): string {
  return `osm:${type}:${id}`;
}

export function isOsmExternalId(externalId: string): boolean {
  return externalId.startsWith("osm:");
}

function firstTag(tags: OsmTags | undefined, keys: string[]): string {
  if (!tags) return "";
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return "";
}

function defaultTitle(tags: OsmTags | undefined): string {
  const shop = tags?.shop?.trim();
  const amenity = tags?.amenity?.trim();
  if (amenity === "kiosk" || shop === "kiosk") return "Kiosk";
  if (shop === "convenience") return "Convenience store";
  if (shop === "greengrocer") return "Greengrocer";
  if (shop === "newsagent") return "Newsagent";
  if (shop === "general") return "General store";
  return "Store";
}

function elementCoords(
  element: OsmOverpassElement,
): { lat: number; lng: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: lat as number, lng: lng as number };
}

/** Map one Overpass element into a locator upsert row (or null if unusable). */
export function mapOsmElementToUpsert(
  element: OsmOverpassElement,
): MinimartStoreUpsert | null {
  if (element.type !== "node" && element.type !== "way" && element.type !== "relation") {
    return null;
  }
  const coords = elementCoords(element);
  if (!coords) return null;

  const tags = element.tags ?? {};
  const title =
    firstTag(tags, ["name:bg", "name", "brand", "operator"]) ||
    defaultTitle(tags);
  const streetName = firstTag(tags, ["addr:street"]);
  const house = firstTag(tags, ["addr:housenumber"]);
  const street =
    firstTag(tags, ["addr:full"]) ||
    [streetName, house].filter(Boolean).join(" ").trim();
  const city = firstTag(tags, [
    "addr:city",
    "addr:town",
    "addr:village",
    "addr:suburb",
  ]);
  const postalCode = firstTag(tags, ["addr:postcode"]) || null;
  const phone = firstTag(tags, ["phone", "contact:phone"]) || null;
  const website = firstTag(tags, ["website", "contact:website"]) || null;
  const openHours = firstTag(tags, ["opening_hours"]) || null;

  return {
    externalId: osmExternalId(element.type, element.id),
    title,
    street,
    city,
    postalCode,
    country: "Bulgaria",
    lat: coords.lat,
    lng: coords.lng,
    phone,
    website,
    openHoursJson: openHours,
    slug: null,
  };
}

export function mapOsmResponseToUpserts(
  payload: OsmOverpassResponse,
): MinimartStoreUpsert[] {
  const byId = new Map<string, MinimartStoreUpsert>();
  for (const element of payload.elements ?? []) {
    const row = mapOsmElementToUpsert(element);
    if (!row) continue;
    byId.set(row.externalId, row);
  }
  return [...byId.values()];
}

/** Inclusive bbox tiles covering Bulgaria (smaller queries avoid Overpass timeouts). */
export function bulgariaBboxTiles(grid = 3): Array<{
  south: number;
  west: number;
  north: number;
  east: number;
}> {
  const { south, west, north, east } = BULGARIA_BBOX;
  const latStep = (north - south) / grid;
  const lngStep = (east - west) / grid;
  const tiles: Array<{
    south: number;
    west: number;
    north: number;
    east: number;
  }> = [];
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      tiles.push({
        south: south + row * latStep,
        west: west + col * lngStep,
        north: row === grid - 1 ? north : south + (row + 1) * latStep,
        east: col === grid - 1 ? east : west + (col + 1) * lngStep,
      });
    }
  }
  return tiles;
}

export function buildOsmRetailOverpassQuery(bbox: {
  south: number;
  west: number;
  north: number;
  east: number;
}): string {
  const { south, west, north, east } = bbox;
  const parts = OSM_RETAIL_TAG_FILTERS.map(
    (filter) => `  nwr${filter}(${south},${west},${north},${east});`,
  ).join("\n");
  return `[out:json][timeout:90];
(
${parts}
);
out center tags;`;
}

async function fetchOverpassTile(
  bbox: { south: number; west: number; north: number; east: number },
  fetchImpl: typeof fetch,
  endpoint: string,
): Promise<MinimartStoreUpsert[]> {
  const query = buildOsmRetailOverpassQuery(bbox);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json",
      "User-Agent": "Expire365AdminOsmLocator/1.0",
    },
    body: new URLSearchParams({ data: query }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`OSM Overpass HTTP ${response.status}`);
  }
  const json = (await response.json()) as OsmOverpassResponse;
  return mapOsmResponseToUpserts(json);
}

/**
 * Fetch small retail / kiosk POIs for Bulgaria from OpenStreetMap (Overpass),
 * tiled so public servers are less likely to time out.
 */
export async function fetchOsmBulgariaRetailStores(
  fetchImpl: typeof fetch = fetch,
  options?: { grid?: number; endpoint?: string; concurrency?: number },
): Promise<MinimartStoreUpsert[]> {
  const endpoint = options?.endpoint ?? OSM_OVERPASS_URL;
  const tiles = bulgariaBboxTiles(options?.grid ?? 2);
  const concurrency = Math.max(1, options?.concurrency ?? 2);
  const byId = new Map<string, MinimartStoreUpsert>();

  for (let i = 0; i < tiles.length; i += concurrency) {
    const batch = tiles.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((tile) => fetchOverpassTile(tile, fetchImpl, endpoint)),
    );
    for (const rows of results) {
      for (const row of rows) {
        byId.set(row.externalId, row);
      }
    }
  }

  return [...byId.values()];
}
