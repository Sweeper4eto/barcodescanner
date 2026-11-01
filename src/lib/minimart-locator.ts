import { z } from "zod";

const ASL_LOAD_URL = "https://mini-mart.bg/wp-admin/admin-ajax.php";
const ASL_SOURCE = "https://mini-mart.bg/nameri-magazin/";

/** Admin CRM visit status for locator pins. */
export const MINIMART_STATUSES = [
  "NOT_VISITED",
  "ACCEPTED",
  "THINKING",
  "REJECTED",
] as const;

export type MinimartVisitStatus = (typeof MINIMART_STATUSES)[number];

export const minimartStatusSchema = z.enum(MINIMART_STATUSES);

/** Marker fill colors on the admin map. */
export const MINIMART_STATUS_COLORS: Record<MinimartVisitStatus, string> = {
  NOT_VISITED: "#3b82f6",
  ACCEPTED: "#22c55e",
  THINKING: "#eab308",
  REJECTED: "#ef4444",
};

export function isMinimartVisitStatus(value: string): value is MinimartVisitStatus {
  return (MINIMART_STATUSES as readonly string[]).includes(value);
}

export const aslStoreSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().optional().default("Minimart"),
  street: z.string().optional().default(""),
  city: z.string().optional().default(""),
  postal_code: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  lat: z.union([z.string(), z.number()]),
  lng: z.union([z.string(), z.number()]),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  open_hours: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
});

export type AslStore = z.infer<typeof aslStoreSchema>;

export type MinimartStoreUpsert = {
  externalId: string;
  title: string;
  street: string;
  city: string;
  postalCode: string | null;
  country: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  openHoursJson: string | null;
  slug: string | null;
};

/** Decode common HTML entities from ASL / CMS address dumps. */
export function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

/**
 * Clean locator address/title text: HTML entities, wrapping ASCII quotes,
 * and messy whitespace from Minimart ASL dumps.
 */
export function normalizeLocatorText(value: string): string {
  let text = decodeBasicHtmlEntities(String(value ?? ""));
  text = text.replace(/\u00a0/g, " ");
  // Drop ASCII quotes that wrapped street/district names after entity decode.
  text = text.replace(/"([^"]+)"/g, "$1");
  text = text.replace(/'([^']+)'/g, "$1");
  text = text.replace(/[ \t\f\v]+/g, " ");
  text = text.replace(/\s+,/g, ",");
  text = text.replace(/,\s*/g, ", ");
  text = text.replace(/\s+\./g, ".");
  // "ж.к.Младост" → "ж.к. Младост" (only before a capital letter; keep ж.к.)
  text = text.replace(/\.([A-ZА-ЯЁІЇЄ])/g, ". $1");
  text = text.replace(/,\s*,+/g, ",");
  return text.trim();
}

export function mapAslStoreToUpsert(raw: AslStore): MinimartStoreUpsert | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;

  return {
    externalId: raw.id,
    title: normalizeLocatorText(raw.title || "Minimart") || "Minimart",
    street: normalizeLocatorText(raw.street || ""),
    city: normalizeLocatorText(raw.city || ""),
    postalCode: normalizeLocatorText(raw.postal_code || "") || null,
    country: normalizeLocatorText(raw.country || "") || null,
    lat,
    lng,
    phone: (raw.phone || "").trim() || null,
    website: (raw.website || "").trim() || null,
    openHoursJson: raw.open_hours?.trim() || null,
    slug: raw.slug?.trim() || null,
  };
}

/** Fetch public Minimart Agile Store Locator payload. */
export async function fetchMinimartAslStores(
  fetchImpl: typeof fetch = fetch,
): Promise<MinimartStoreUpsert[]> {
  const body = new URLSearchParams({ action: "asl_load_stores" });
  const response = await fetchImpl(ASL_LOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "Expire365AdminMinimartSync/1.0",
      Referer: ASL_SOURCE,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Minimart locator HTTP ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("Minimart locator returned unexpected payload");
  }

  const mapped: MinimartStoreUpsert[] = [];
  for (const row of json) {
    const parsed = aslStoreSchema.safeParse(row);
    if (!parsed.success) continue;
    const upsert = mapAslStoreToUpsert(parsed.data);
    if (upsert) mapped.push(upsert);
  }

  return mapped;
}

export { ASL_SOURCE };
