import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  namesMatchForMerge,
  normalizeProductNameForMatch,
} from "../src/lib/product-name-match";

describe("normalizeProductNameForMatch", () => {
  it("strips punctuation/symbols but keeps letters and digits", () => {
    assert.equal(
      normalizeProductNameForMatch("Ябълка , 10 % сайдер"),
      "ябълка 10 сайдер",
    );
    assert.equal(
      normalizeProductNameForMatch("Ябълка 10 Сайдер"),
      "ябълка 10 сайдер",
    );
  });

  it("collapses repeated whitespace and trims", () => {
    assert.equal(normalizeProductNameForMatch("  Milk   2L  "), "milk 2l");
  });
});

describe("namesMatchForMerge", () => {
  it("matches names that only differ by punctuation/symbols", () => {
    assert.equal(
      namesMatchForMerge("Ябълка , 10 % сайдер", "Ябълка 10 Сайдер"),
      true,
    );
    assert.equal(
      namesMatchForMerge("Milk!!! 2L.", "milk 2l"),
      true,
    );
  });

  it("does not match when a number differs", () => {
    assert.equal(
      namesMatchForMerge("Ябълка 5 % сайдер", "Ябълка 10 Сайдер"),
      false,
    );
  });

  it("does not match when words differ", () => {
    assert.equal(
      namesMatchForMerge("Ябълка 10 сайдер", "Ябълка 10 сок"),
      false,
    );
  });

  it("does not match when one name has extra words", () => {
    assert.equal(
      namesMatchForMerge("Ябълка 10 сайдер", "Ябълка 10 сайдер лайт"),
      false,
    );
  });

  it("does not match two empty/symbol-only names", () => {
    assert.equal(namesMatchForMerge("...", "!!!"), false);
  });
});
