import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftHasMissingInfo,
  draftHasWarnings,
  draftItemValid,
  draftMatchesSearch,
  draftWarnings,
  type DocumentDraftItem,
} from "../src/lib/document-draft";

const base: DocumentDraftItem = {
  key: "1",
  name: "Milk",
  barcode: "",
  articul: "123",
  expiryYmd: "2026-12-01",
  quantity: "2",
  productId: null,
  productImagePath: null,
  matchSource: null,
};

describe("document-draft", () => {
  it("detects missing name or expiry", () => {
    assert.equal(draftHasMissingInfo(base), false);
    assert.equal(draftHasMissingInfo({ ...base, name: "  " }), true);
    assert.equal(draftHasMissingInfo({ ...base, expiryYmd: "" }), true);
  });

  it("validates complete rows", () => {
    assert.equal(draftItemValid(base), true);
    assert.equal(draftItemValid({ ...base, quantity: "0" }), false);
  });

  it("does not warn about catalog match; still flags bad barcodes", () => {
    const unmatched = draftWarnings({
      ...base,
      barcode: "",
      productId: null,
    });
    assert.equal(unmatched.includes("noProductMatch" as never), false);
    assert.equal(draftHasWarnings({ ...base, productId: null }), false);

    const warnings = draftWarnings({
      ...base,
      barcode: "1234567890123",
      productId: null,
    });
    assert.ok(warnings.includes("invalidBarcode"));
    assert.equal(warnings.includes("noProductMatch" as never), false);
  });

  it("filters by search needle", () => {
    assert.equal(draftMatchesSearch(base, "milk"), true);
    assert.equal(draftMatchesSearch(base, "123"), true);
    assert.equal(draftMatchesSearch(base, "bread"), false);
  });
});