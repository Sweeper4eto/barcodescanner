import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftHasMissingInfo,
  draftItemValid,
  draftMatchesSearch,
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

  it("filters by search needle", () => {
    assert.equal(draftMatchesSearch(base, "milk"), true);
    assert.equal(draftMatchesSearch(base, "123"), true);
    assert.equal(draftMatchesSearch(base, "bread"), false);
  });
});
