import test from "node:test";
import assert from "node:assert/strict";
import {
  filterInventoryEntriesBySearch,
  matchesInventorySearch,
} from "../src/lib/inventory-search";

const yogurt = {
  barcode: "5901234567890",
  product: { name: "Vitamin C compounds" },
};

const milkBg = {
  barcode: "222",
  product: { name: "Мляко 3.2%" },
};

test("matchesInventorySearch is case-insensitive on product name", () => {
  assert.equal(matchesInventorySearch(yogurt, "vitamin"), true);
  assert.equal(matchesInventorySearch(yogurt, "VITAMIN"), true);
  assert.equal(matchesInventorySearch(yogurt, "comp"), true);
});

test("matchesInventorySearch matches Cyrillic names", () => {
  assert.equal(matchesInventorySearch(milkBg, "мляко"), true);
  assert.equal(matchesInventorySearch(milkBg, "МЛЯКО"), true);
});

test("matchesInventorySearch matches barcode fragments", () => {
  assert.equal(matchesInventorySearch(yogurt, "590123"), true);
  assert.equal(matchesInventorySearch(yogurt, "999"), false);
});

test("matchesInventorySearch supports multi-word queries", () => {
  assert.equal(matchesInventorySearch(yogurt, "vitamin c"), true);
  assert.equal(matchesInventorySearch(yogurt, "vitamin x"), false);
});

test("filterInventoryEntriesBySearch returns only matching entries", () => {
  const results = filterInventoryEntriesBySearch([yogurt, milkBg], "мля");
  assert.equal(results.length, 1);
  assert.equal(results[0].product.name, milkBg.product.name);
});
