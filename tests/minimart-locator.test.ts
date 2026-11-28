import test from "node:test";
import assert from "node:assert/strict";
import {
  aslStoreSchema,
  isMinimartVisitStatus,
  mapAslStoreToUpsert,
  MINIMART_STATUS_COLORS,
  MINIMART_STATUSES,
  normalizeLocatorText,
} from "../src/lib/minimart-locator";
import {
  MINIMART_MAP_MAX_ZOOM,
  MINIMART_MAP_TILE_ATTRIBUTION,
  MINIMART_MAP_TILE_URL,
} from "../src/lib/minimart-map-tiles";

test("mapAslStoreToUpsert maps ASL payload fields", () => {
  const parsed = aslStoreSchema.parse({
    id: 65,
    title: "Minimart",
    street: "ул. Тест 1",
    city: "София",
    postal_code: "1000",
    country: "Bulgaria",
    lat: "42.7",
    lng: "23.3",
    phone: "",
    website: "https://mini-mart.bg/",
    open_hours: "{}",
    slug: "minimart-sofia",
  });
  const row = mapAslStoreToUpsert(parsed);
  assert.ok(row);
  assert.equal(row.externalId, "65");
  assert.equal(row.city, "София");
  assert.equal(row.lat, 42.7);
  assert.equal(row.lng, 23.3);
});

test("mapAslStoreToUpsert rejects invalid coordinates", () => {
  const parsed = aslStoreSchema.parse({
    id: "1",
    lat: "x",
    lng: "y",
  });
  assert.equal(mapAslStoreToUpsert(parsed), null);
});

test("normalizeLocatorText strips ASL HTML entities and wrapping quotes", () => {
  assert.equal(
    normalizeLocatorText(
      'р-н &quot;Триадица&quot;, кв. &quot;Манастирски ливади&quot;, ул. &quot;Васил Стефанов&quot; №55',
    ),
    "р-н Триадица, кв. Манастирски ливади, ул. Васил Стефанов №55",
  );
  assert.equal(
    normalizeLocatorText("ул. &#039;Марко Балабанов&#039; № 1"),
    "ул. Марко Балабанов № 1",
  );
  assert.equal(
    normalizeLocatorText("ж.к.&quot;Меден Рудник&quot;, ул. 1"),
    "ж.к. Меден Рудник, ул. 1",
  );
  assert.equal(
    normalizeLocatorText("район &quot;Надежда&quot; , ул. Тест  5"),
    "район Надежда, ул. Тест 5",
  );
});

test("mapAslStoreToUpsert cleans encoded street text", () => {
  const parsed = aslStoreSchema.parse({
    id: 452,
    title: "Minimart",
    street:
      'р-н &quot;Триадица&quot;, ул. &quot;Васил Стефанов&quot; №55',
    city: "София",
    lat: 42.7,
    lng: 23.3,
  });
  const row = mapAslStoreToUpsert(parsed);
  assert.ok(row);
  assert.equal(
    row.street,
    "р-н Триадица, ул. Васил Стефанов №55",
  );
});

test("minimart status colors cover all statuses", () => {
  for (const status of MINIMART_STATUSES) {
    assert.equal(typeof MINIMART_STATUS_COLORS[status], "string");
    assert.ok(MINIMART_STATUS_COLORS[status].startsWith("#"));
  }
  assert.equal(isMinimartVisitStatus("ACCEPTED"), true);
  assert.equal(isMinimartVisitStatus("marked"), false);
});

test("minimart map uses a dark basemap without requiring a Carto key by default", () => {
  // Without NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY, fall back to Esri dark-gray
  // (CARTO CDN watermarks every tile with "API KEY REQUIRED" since Sep 2026).
  if ((process.env.NEXT_PUBLIC_CARTO_BASEMAPS_API_KEY ?? "").trim()) {
    assert.match(MINIMART_MAP_TILE_URL, /basemaps\.cartocdn\.com\/dark_all/);
    assert.match(MINIMART_MAP_TILE_URL, /[?&]key=/);
    assert.match(MINIMART_MAP_TILE_ATTRIBUTION, /CARTO/);
    assert.ok(MINIMART_MAP_MAX_ZOOM >= 18);
  } else {
    assert.match(MINIMART_MAP_TILE_URL, /arcgisonline\.com\/.*World_Dark_Gray_Base/);
    assert.match(MINIMART_MAP_TILE_ATTRIBUTION, /Esri/);
    assert.ok(MINIMART_MAP_MAX_ZOOM >= 16);
  }
});
