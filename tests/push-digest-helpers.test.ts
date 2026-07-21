import test from "node:test";
import assert from "node:assert/strict";
import { daysUntilExpiry, shouldSendDigest } from "../src/lib/push-expiry";

test("shouldSendDigest allows first send and blocks within 20 hours", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  assert.equal(shouldSendDigest(null, now), true);
  assert.equal(
    shouldSendDigest(new Date("2026-07-22T01:00:00Z"), now),
    false,
  );
  assert.equal(
    shouldSendDigest(new Date("2026-07-21T10:00:00Z"), now),
    true,
  );
});

test("daysUntilExpiry uses calendar rounding", () => {
  const now = new Date("2026-07-22T10:00:00Z");
  const expiry = new Date("2026-07-24T08:00:00Z");
  assert.equal(daysUntilExpiry(expiry, now), 2);
});
