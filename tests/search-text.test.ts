import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSearchText,
  searchTextIncludes,
  sqlFoldColumn,
} from "../src/lib/search-text";

test("normalizeSearchText folds Latin and Cyrillic case", () => {
  assert.equal(normalizeSearchText("  Milk  "), "milk");
  assert.equal(normalizeSearchText("МЛЯКО"), "мляко");
  assert.equal(normalizeSearchText("Мляко"), "мляко");
});

test("searchTextIncludes is case-insensitive for Bulgarian", () => {
  assert.equal(searchTextIncludes("Мляко Верея", "мляко"), true);
  assert.equal(searchTextIncludes("Мляко Верея", "МЛЯКО"), true);
  assert.equal(searchTextIncludes("Мляко Верея", "верея"), true);
  assert.equal(searchTextIncludes("Мляко Верея", "хляб"), false);
});

test("searchTextIncludes is case-insensitive for English", () => {
  assert.equal(searchTextIncludes("Vitamin C", "vitamin"), true);
  assert.equal(searchTextIncludes("Vitamin C", "VITAMIN"), true);
});

test("sqlFoldColumn rejects unsafe identifiers", () => {
  assert.throws(() => sqlFoldColumn("name; DROP TABLE Product"));
  assert.throws(() => sqlFoldColumn("name FROM Product"));
});

test("sqlFoldColumn wraps LOWER and Cyrillic REPLACE for trusted columns", () => {
  const text = JSON.stringify(sqlFoldColumn("Product.name"));
  assert.match(text, /LOWER\(Product\.name\)/);
  assert.match(text, /REPLACE/);
  assert.match(text, /А/);
  assert.match(text, /а/);
});
