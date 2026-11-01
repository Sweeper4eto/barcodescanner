import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bulgariaBboxTiles,
  buildOsmRetailOverpassQuery,
  isOsmExternalId,
  mapOsmElementToUpsert,
  mapOsmResponseToUpserts,
  osmExternalId,
} from "../src/lib/osm-locator";

describe("osm locator", () => {
  test("builds stable external ids", () => {
    assert.equal(osmExternalId("node", 42), "osm:node:42");
    assert.equal(isOsmExternalId("osm:way:9"), true);
    assert.equal(isOsmExternalId("65"), false);
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
    assert.match(query, /out center tags/);
  });
});
