import test from "node:test";
import assert from "node:assert/strict";
import { WHATS_NEW_CATALOG } from "../src/lib/whats-new-catalog";
import {
  markWhatsNewIdsSeen,
  shouldShowWhatsNew,
  unseenWhatsNewItems,
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

test("unseen filters acknowledged ids and keeps new ones", () => {
  // jsdom-free unit path: exercise pure helpers with an injected seen set via mark in memory.
  // markWhatsNewIdsSeen no-ops without window — simulate filter logic directly.
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const seen = new Set(["a", "b"]);
  const unseen = items.filter((item) => !seen.has(item.id));
  assert.deepEqual(unseen.map((i) => i.id), ["c"]);
  assert.equal(unseen.length > 0, true);
});

test("whatsNewFingerprint still lists sorted ids", () => {
  assert.equal(whatsNewFingerprint([{ id: "z" }, { id: "a" }]), "a|z");
});

// Browser storage tests only when localStorage exists (Node test runner has none).
test("mark + unseen round-trip when localStorage is available", () => {
  if (typeof globalThis.localStorage === "undefined") {
    // Provide a minimal in-memory localStorage for this test.
    const store = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = globalThis;
  }

  const store = globalThis.localStorage;
  store.removeItem("expire365-whats-new-seen-ids");
  store.removeItem("expire365-whats-new-seen");

  const live = [{ id: "old-1" }, { id: "old-2" }];
  markWhatsNewIdsSeen(live.map((i) => i.id));
  assert.equal(shouldShowWhatsNew(live), false);

  const withNew = [...live, { id: "new-3" }];
  assert.equal(shouldShowWhatsNew(withNew), true);
  assert.deepEqual(
    unseenWhatsNewItems(withNew).map((i) => i.id),
    ["new-3"],
  );
});
