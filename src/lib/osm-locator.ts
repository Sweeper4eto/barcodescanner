import { execFile } from "node:child_process";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import type { MinimartStoreUpsert } from "@/lib/minimart-locator";

const execFileAsync = promisify(execFile);

/** Geofabrik country extract — reliable offline-style import (Overpass public mirrors are often at capacity). */
export const OSM_GEOFABRIK_BULGARIA_PBF_URL =
  "https://download.geofabrik.de/europe/bulgaria-latest.osm.pbf";
export const OSM_ATTRIBUTION = "https://www.openstreetmap.org/copyright";
export const OSM_PBF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const OSM_PBF_FILENAME = "bulgaria-latest.osm.pbf";

/** Bulgaria mainland + nearby bounds (drop stray border nodes if any). */
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

export const OSM_RETAIL_SHOP_VALUES = new Set([
  "kiosk",
  "convenience",
  "greengrocer",
  "newsagent",
  "general",
]);

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

export type OsmPbfNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: OsmTags;
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

export function isOsmRetailTags(tags: OsmTags | undefined): boolean {
  if (!tags) return false;
  // Gas-station shops are tagged shop=convenience but are not kiosk targets.
  if (tags.amenity?.trim() === "fuel") return false;
  if (tags.amenity?.trim() === "kiosk") return true;
  const shop = tags.shop?.trim();
  return Boolean(shop && OSM_RETAIL_SHOP_VALUES.has(shop));
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

function inBulgariaBbox(lat: number, lng: number): boolean {
  return (
    lat >= BULGARIA_BBOX.south &&
    lat <= BULGARIA_BBOX.north &&
    lng >= BULGARIA_BBOX.west &&
    lng <= BULGARIA_BBOX.east
  );
}

/** Map one OSM element into a locator upsert row (or null if unusable). */
export function mapOsmElementToUpsert(
  element: OsmOverpassElement,
): MinimartStoreUpsert | null {
  if (element.type !== "node" && element.type !== "way" && element.type !== "relation") {
    return null;
  }
  const coords = elementCoords(element);
  if (!coords) return null;
  if (!inBulgariaBbox(coords.lat, coords.lng)) return null;

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
    if (!isOsmRetailTags(element.tags)) continue;
    const row = mapOsmElementToUpsert(element);
    if (!row) continue;
    byId.set(row.externalId, row);
  }
  return [...byId.values()];
}

/** Inclusive bbox tiles (kept for tests / optional Overpass tooling). */
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
    (filter) => `  node${filter}(${south},${west},${north},${east});`,
  ).join("\n");
  return `[out:json][timeout:60];
(
${parts}
);
out body;`;
}

export function resolveOsmCacheDir(): string {
  const configured = process.env.OSM_CACHE_DIR?.trim();
  if (configured) return configured;
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (dbUrl.startsWith("file:")) {
    const filePath = dbUrl.slice("file:".length);
    return path.join(path.dirname(filePath), "osm-cache");
  }
  return path.join(process.cwd(), ".cache", "osm");
}

export function osmPbfCachePath(cacheDir = resolveOsmCacheDir()): string {
  return path.join(cacheDir, OSM_PBF_FILENAME);
}

async function isFreshFile(
  filePath: string,
  maxAgeMs: number,
): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size < 1_000_000) return false;
    return Date.now() - stat.mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * Ensure a Bulgaria PBF sits on disk (download from Geofabrik when missing/stale).
 */
export async function ensureBulgariaOsmPbf(
  options?: {
    cacheDir?: string;
    url?: string;
    maxAgeMs?: number;
    force?: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const cacheDir = options?.cacheDir ?? resolveOsmCacheDir();
  const target = osmPbfCachePath(cacheDir);
  const maxAgeMs = options?.maxAgeMs ?? OSM_PBF_MAX_AGE_MS;
  if (!options?.force && (await isFreshFile(target, maxAgeMs))) {
    return target;
  }

  await fs.mkdir(cacheDir, { recursive: true });
  const tempPath = `${target}.download`;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = options?.url ?? OSM_GEOFABRIK_BULGARIA_PBF_URL;

  const response = await fetchImpl(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Expire365AdminOsmLocator/1.0 (+https://expire365.com)",
      Accept: "application/octet-stream",
    },
    cache: "no-store",
  });
  if (!response.ok || !response.body) {
    throw new Error(`OSM Geofabrik HTTP ${response.status}`);
  }

  const nodeStream = Readable.fromWeb(
    response.body as import("node:stream/web").ReadableStream,
  );
  try {
    await pipeline(nodeStream, createWriteStream(tempPath));
    const stat = await fs.stat(tempPath);
    if (stat.size < 1_000_000) {
      throw new Error("OSM Geofabrik download too small");
    }
    await fs.rename(tempPath, target);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
  return target;
}

type ParseOsmFactory = () => NodeJS.ReadWriteStream;

export function osmPbfParseScriptPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, "scripts", "parse-osm-bulgaria-pbf.mjs");
}

/**
 * Parse via a child Node process so osm-pbf-parser/.proto never go through
 * the Next.js webpack bundle (which breaks on prod).
 */
export async function parseOsmPbfRetailStoresViaChild(
  pbfPath: string,
  options?: { scriptPath?: string; timeoutMs?: number },
): Promise<MinimartStoreUpsert[]> {
  const scriptPath = options?.scriptPath ?? osmPbfParseScriptPath();
  const outPath = `${pbfPath}.retail.json`;
  try {
    await execFileAsync(process.execPath, [scriptPath, pbfPath, outPath], {
      cwd: process.cwd(),
      timeout: options?.timeoutMs ?? 240_000,
      maxBuffer: 16 * 1024 * 1024,
      env: process.env,
    });
    const raw = await fs.readFile(outPath, "utf8");
    const parsed = JSON.parse(raw) as MinimartStoreUpsert[];
    if (!Array.isArray(parsed)) {
      throw new Error("OSM PBF parse produced invalid JSON");
    }
    return parsed;
  } finally {
    await fs.unlink(outPath).catch(() => undefined);
  }
}

/** Stream-parse a local PBF (tests can inject parseFactory; prod uses child). */
export async function parseOsmPbfRetailStores(
  pbfPath: string,
  options?: { parseFactory?: ParseOsmFactory },
): Promise<MinimartStoreUpsert[]> {
  if (!options?.parseFactory) {
    return parseOsmPbfRetailStoresViaChild(pbfPath);
  }
  const parseFactory = options.parseFactory;
  const byId = new Map<string, MinimartStoreUpsert>();

  const collect = new Transform({
    objectMode: true,
    transform(items: unknown, _enc, callback) {
      try {
        const list = Array.isArray(items) ? items : [items];
        for (const raw of list) {
          const item = raw as OsmPbfNode;
          if (!item || item.type !== "node") continue;
          if (!isOsmRetailTags(item.tags)) continue;
          const row = mapOsmElementToUpsert(item);
          if (!row) continue;
          byId.set(row.externalId, row);
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });

  await pipeline(createReadStream(pbfPath), parseFactory(), collect);
  return [...byId.values()];
}

/**
 * Import Bulgaria retail/kiosk POIs from a Geofabrik PBF (cached on disk).
 * Avoids flaky public Overpass capacity limits.
 */
export async function fetchOsmBulgariaRetailStores(
  _fetchImpl: typeof fetch = fetch,
  options?: {
    cacheDir?: string;
    url?: string;
    maxAgeMs?: number;
    forceDownload?: boolean;
    fetchImpl?: typeof fetch;
    parseFactory?: ParseOsmFactory;
  },
): Promise<MinimartStoreUpsert[]> {
  const fetchImpl = options?.fetchImpl ?? _fetchImpl;
  const pbfPath = await ensureBulgariaOsmPbf({
    cacheDir: options?.cacheDir,
    url: options?.url,
    maxAgeMs: options?.maxAgeMs,
    force: options?.forceDownload,
    fetchImpl,
  });
  return parseOsmPbfRetailStores(pbfPath, {
    parseFactory: options?.parseFactory,
  });
}
