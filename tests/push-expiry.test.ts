import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpiryDigestPayload,
  daysUntilExpiry,
  shouldSendDigest,
} from "../src/lib/push-expiry";

test("daysUntilExpiry rounds up partial days", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const expiry = new Date("2026-06-03T01:00:00Z");
  assert.equal(daysUntilExpiry(expiry, now), 2);
});

test("buildExpiryDigestPayload returns null for empty list", () => {
  assert.equal(buildExpiryDigestPayload([]), null);
});

test("buildExpiryDigestPayload highlights critical items in English", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Milk",
        storeName: "Central",
        storeId: "store-1",
        quantity: 3,
        daysUntilExpiry: 5,
      },
    ],
    "en",
  );

  assert.ok(payload);
  assert.match(payload.title, /Milk/);
  assert.match(payload.body, /Central/);
  assert.equal(payload.url, "/app/expiry?storeId=store-1");
});

test("buildExpiryDigestPayload highlights critical items in Bulgarian", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Мляко",
        storeName: "Централен",
        storeId: "store-1",
        quantity: 3,
        daysUntilExpiry: 5,
      },
    ],
    "bg",
  );

  assert.ok(payload);
  assert.match(payload.title, /Мляко/);
  assert.match(payload.body, /Централен/);
});

test("buildExpiryDigestPayload links to app home for multiple stores", () => {
  const payload = buildExpiryDigestPayload(
    [
      {
        productName: "Milk",
        storeName: "Central",
        storeId: "store-1",
        quantity: 1,
        daysUntilExpiry: 4,
      },
      {
        productName: "Bread",
        storeName: "North",
        storeId: "store-2",
        quantity: 2,
        daysUntilExpiry: 5,
      },
    ],
    "en",
  );

  assert.ok(payload);
  assert.equal(payload.url, "/app");
});

test("shouldSendDigest throttles repeat sends within 20 hours", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  const recent = new Date("2026-06-02T08:00:00Z");
  const old = new Date("2026-06-01T08:00:00Z");

  assert.equal(shouldSendDigest(null, now), true);
  assert.equal(shouldSendDigest(recent, now), false);
  assert.equal(shouldSendDigest(old, now), true);
});
