import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPIRY_EXPORT_MAX_ITEMS,
  expiryExportDecision,
} from "../src/lib/expiry-selection-export";

test("expiry picture export allows 1 through 20 selected items", () => {
  assert.equal(EXPIRY_EXPORT_MAX_ITEMS, 20);
  assert.equal(expiryExportDecision(0), "empty");
  assert.equal(expiryExportDecision(1), "ok");
  assert.equal(expiryExportDecision(20), "ok");
  assert.equal(expiryExportDecision(21), "too-many");
});
