/**
 * Standalone PBF → retail/kiosk JSON. Runs outside the Next.js bundle so
 * osm-pbf-parser can load its .proto files from node_modules.
 *
 * Usage: node scripts/parse-osm-bulgaria-pbf.mjs <input.pbf> <output.json>
 */
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const require = createRequire(import.meta.url);
const parseOSM = require("osm-pbf-parser");

const SHOPS = new Set([
  "kiosk",
  "convenience",
  "greengrocer",
  "newsagent",
  "general",
]);
const BBOX = { south: 41.2, west: 22.35, north: 44.25, east: 28.7 };

const pbfPath = process.argv[2];
const outPath = process.argv[3];
if (!pbfPath || !outPath) {
  console.error(
    "Usage: node scripts/parse-osm-bulgaria-pbf.mjs <input.pbf> <output.json>",
  );
  process.exit(2);
}

function isRetail(tags) {
  if (!tags) return false;
  if (tags.amenity === "fuel") return false;
  if (tags.amenity === "kiosk") return true;
  return Boolean(tags.shop && SHOPS.has(tags.shop));
}

function firstTag(tags, keys) {
  for (const key of keys) {
    const value = tags?.[key]?.trim?.() ?? "";
    if (value) return value;
  }
  return "";
}

function defaultTitle(tags) {
  const shop = tags?.shop;
  const amenity = tags?.amenity;
  if (amenity === "kiosk" || shop === "kiosk") return "Kiosk";
  if (shop === "convenience") return "Convenience store";
  if (shop === "greengrocer") return "Greengrocer";
  if (shop === "newsagent") return "Newsagent";
  if (shop === "general") return "General store";
  return "Store";
}

function mapNode(item) {
  const lat = item.lat;
  const lng = item.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < BBOX.south || lat > BBOX.north || lng < BBOX.west || lng > BBOX.east) {
    return null;
  }
  const tags = item.tags || {};
  const streetName = firstTag(tags, ["addr:street"]);
  const house = firstTag(tags, ["addr:housenumber"]);
  const street =
    firstTag(tags, ["addr:full"]) ||
    [streetName, house].filter(Boolean).join(" ").trim();
  return {
    externalId: `osm:node:${item.id}`,
    title:
      firstTag(tags, ["name:bg", "name", "brand", "operator"]) ||
      defaultTitle(tags),
    street,
    city: firstTag(tags, [
      "addr:city",
      "addr:town",
      "addr:village",
      "addr:suburb",
    ]),
    postalCode: firstTag(tags, ["addr:postcode"]) || null,
    country: "Bulgaria",
    lat,
    lng,
    phone: firstTag(tags, ["phone", "contact:phone"]) || null,
    website: firstTag(tags, ["website", "contact:website"]) || null,
    openHoursJson: firstTag(tags, ["opening_hours"]) || null,
    slug: null,
  };
}

const byId = new Map();
const collect = new Transform({
  objectMode: true,
  transform(items, _enc, callback) {
    for (const item of Array.isArray(items) ? items : [items]) {
      if (!item || item.type !== "node") continue;
      if (!isRetail(item.tags)) continue;
      const row = mapNode(item);
      if (!row) continue;
      byId.set(row.externalId, row);
    }
    callback();
  },
});

const t0 = Date.now();
await pipeline(createReadStream(pbfPath), parseOSM(), collect);
const rows = [...byId.values()];
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(rows));
console.error(
  JSON.stringify({
    ok: true,
    count: rows.length,
    ms: Date.now() - t0,
    script: fileURLToPath(import.meta.url),
  }),
);
