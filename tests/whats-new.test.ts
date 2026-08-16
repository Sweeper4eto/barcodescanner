import test from "node:test";
import assert from "node:assert/strict";
import { WHATS_NEW_CATALOG } from "../src/lib/whats-new-catalog";
import {
  shouldShowWhatsNew,
  whatsNewFingerprint,
} from "../src/lib/whats-new";

test("catalog has unique keys", () => {
  const keys = WHATS_NEW_CATALOG.map((e) => e.key);
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(keys.length >= 1);
});

test("catalog entries have EN and BG titles", () => {
  for (const entry of WHATS_NEW_CATALOG) {
    assert.ok(entry.titleEn.trim().length > 0, entry.key);
    assert.ok(entry.titleBg.trim().length > 0, entry.key);
  }
});

test("fingerprint is stable regardless of order", () => {
  assert.equal(
    whatsNewFingerprint([{ id: "b" }, { id: "a" }]),
    whatsNewFingerprint([{ id: "a" }, { id: "b" }]),
  );
});

test("shouldShowWhatsNew is false with empty list", () => {
  assert.equal(shouldShowWhatsNew([]), false);
});

test("shouldShowWhatsNew is true when fingerprint differs", () => {
  assert.equal(shouldShowWhatsNew([{ id: "a" }], "other"), true);
});

test("shouldShowWhatsNew is false when fingerprint matches", () => {
  const items = [{ id: "a" }, { id: "b" }];
  assert.equal(shouldShowWhatsNew(items, whatsNewFingerprint(items)), false);
});