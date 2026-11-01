import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Transform } from "node:stream";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bulgariaBboxTiles,
  buildOsmRetailOverpassQuery,
  ensureBulgariaOsmPbf,
  isOsmExternalId,
  isOsmRetailTags,
  mapOsmElementToUpsert,
  mapOsmResponseToUpserts,
  osmExternalId,
  osmPbfCachePath,
  parseOsmPbfRetailStores,
  resolveOsmCacheDir,
} from "../src/lib/osm-locator";

describe("osm locator", () => {
  test("builds stable external ids", () => {
    assert.equal(osmExternalId("node", 42), "osm:node:42");
    assert.equal(isOsmExternalId("osm:way:9"), true);
    assert.equal(isOsmExternalId("65"), false);
  });

  test("detects retail tags", () => {
    assert.equal(isOsmRetailTags({ amenity: "kiosk" }), true);
    assert.equal(isOsmRetailTags({ shop: "convenience" }), true);
    assert.equal(isOsmRetailTags({ shop: "supermarket" }), false);
    assert.equal(isOsmRetailTags({ amenity: "bank" }), false);
    assert.equal(
      isOsmRetailTags({ amenity: "fuel", shop: "convenience" }),
      false,
    );
  });

  test("maps a named convenience node", () => {
    const row = mapOsmElementToUpsert({
      type: "node",
      id: 1001,
      lat: 42.7,
      lon: 23.3,
      tags: {
        shop: "convenience",
        name: "Магазин Тест",
        "addr:street": "ул. Витоша",
        "addr:housenumber": "10",
        "addr:city": "София",
        "addr:postcode": "1000",
        phone: "+359888000000",
      },
    });
    assert.ok(row);
    assert.equal(row.externalId, "osm:node:1001");
    assert.equal(row.title, "Магазин Тест");
    assert.equal(row.street, "ул. Витоша 10");
    assert.equal(row.city, "София");
    assert.equal(row.postalCode, "1000");
    assert.equal(row.country, "Bulgaria");
    assert.equal(row.lat, 42.7);
    assert.equal(row.lng, 23.3);
  });

  test("maps way with center and fallback title", () => {
    const row = mapOsmElementToUpsert({
      type: "way",
      id: 55,
      center: { lat: 43.2, lon: 27.9 },
      tags: { amenity: "kiosk" },
    });
    assert.ok(row);
    assert.equal(row.externalId, "osm:way:55");
    assert.equal(row.title, "Kiosk");
    assert.equal(row.city, "");
  });

  test("rejects elements without coordinates", () => {
    assert.equal(
      mapOsmElementToUpsert({ type: "way", id: 1, tags: { shop: "kiosk" } }),
      null,
    );
  });

  test("dedupes response elements by osm id", () => {
    const rows = mapOsmResponseToUpserts({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 42,
          lon: 23,
          tags: { shop: "kiosk", name: "A" },
        },
        {
          type: "node",
          id: 1,
          lat: 42.1,
          lon: 23.1,
          tags: { shop: "kiosk", name: "B" },
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.title, "B");
  });

  test("tiles cover bulgaria without gaps at edges", () => {
    const tiles = bulgariaBboxTiles(2);
    assert.equal(tiles.length, 4);
    assert.equal(tiles[0]?.south, 41.2);
    assert.equal(tiles[tiles.length - 1]?.north, 44.25);
    assert.equal(tiles[tiles.length - 1]?.east, 28.7);
  });

  test("overpass query includes retail filters and bbox", () => {
    const query = buildOsmRetailOverpassQuery({
      south: 42,
      west: 23,
      north: 43,
      east: 24,
    });
    assert.match(query, /shop"="convenience"/);
    assert.match(query, /amenity"="kiosk"/);
    assert.match(query, /\(42,23,43,24\)/);
    assert.match(query, /out body/);
  });

  test("resolves cache path next to sqlite db file", () => {
    const prev = process.env.DATABASE_URL;
    const prevCache = process.env.OSM_CACHE_DIR;
    process.env.DATABASE_URL = "file:E:/data/magazin/data.db";
    delete process.env.OSM_CACHE_DIR;
    try {
      assert.equal(
        path.normalize(resolveOsmCacheDir()),
        path.normalize("E:/data/magazin/osm-cache"),
      );
      assert.equal(
        path.normalize(osmPbfCachePath()),
        path.normalize("E:/data/magazin/osm-cache/bulgaria-latest.osm.pbf"),
      );
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
      if (prevCache === undefined) delete process.env.OSM_CACHE_DIR;
      else process.env.OSM_CACHE_DIR = prevCache;
    }
  });

  test("downloads pbf when missing then reuses cache", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "osm-cache-"));
    const payload = Buffer.alloc(1_500_000, 1);
    let fetches = 0;
    const fetchImpl = async () => {
      fetches += 1;
      return new Response(payload, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    };
    const first = await ensureBulgariaOsmPbf({
      cacheDir: dir,
      fetchImpl: fetchImpl as typeof fetch,
      maxAgeMs: 60_000,
    });
    const second = await ensureBulgariaOsmPbf({
      cacheDir: dir,
      fetchImpl: fetchImpl as typeof fetch,
      maxAgeMs: 60_000,
    });
    assert.equal(first, second);
    assert.equal(fetches, 1);
    const stat = await fs.stat(first);
    assert.ok(stat.size >= 1_000_000);
    await fs.rm(dir, { recursive: true, force: true });
  });

  test("parses retail nodes from a mock pbf stream", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "osm-parse-"));
    const pbfPath = path.join(dir, "fake.osm.pbf");
    await fs.writeFile(pbfPath, "fake");

    const parseFactory = () =>
      new Transform({
        objectMode: true,
        transform(_chunk, _enc, callback) {
          callback();
        },
        flush(callback) {
          this.push([
            {
              type: "node",
              id: 11,
              lat: 42.7,
              lon: 23.3,
              tags: { shop: "convenience", name: "A" },
            },
            {
              type: "node",
              id: 12,
              lat: 42.71,
              lon: 23.31,
              tags: { amenity: "bank" },
            },
            {
              type: "way",
              id: 99,
              tags: { shop: "kiosk" },
              refs: [],
            },
          ]);
          callback();
        },
      });

    const rows = await parseOsmPbfRetailStores(pbfPath, { parseFactory });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.title, "A");
    await fs.rm(dir, { recursive: true, force: true });
  });
});
