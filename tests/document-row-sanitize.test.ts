import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLikelyInvalidBarcode,
  looksLikeEan,
  sanitizeDocumentRow,
} from "../src/lib/document-row-sanitize";

describe("sanitizeDocumentRow", () => {
  it("normalizes EAN-shaped barcode digits only", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: "4006381333931",
      articul: "SKU-99",
      expiryYmd: "2026-12-01",
      quantity: 2,
    });
    assert.equal(row.barcode, "4006381333931");
    assert.equal(row.articul, "SKU-99");
  });

  it("does not move invalid barcode into articul", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: "1234567890123",
      articul: "A-100",
      expiryYmd: "2026-12-01",
      quantity: 2,
    });
    assert.equal(row.barcode, "1234567890123");
    assert.equal(row.articul, "A-100");
  });

  it("does not promote articul to barcode", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: null,
      articul: "4006381333931",
      expiryYmd: "2026-12-01",
      quantity: 1,
    });
    assert.equal(row.barcode, null);
    assert.equal(row.articul, "4006381333931");
  });

  it("caps absurd quantities", () => {
    const row = sanitizeDocumentRow({
      name: "Milk",
      barcode: null,
      articul: "123",
      expiryYmd: "2026-12-01",
      quantity: 99999,
    });
    assert.equal(row.quantity, 999);
  });

  it("detects likely invalid barcodes", () => {
    assert.equal(looksLikeEan("1234567890123"), true);
    assert.equal(isLikelyInvalidBarcode("1234567890123"), true);
    assert.equal(isLikelyInvalidBarcode("4006381333931"), false);
  });
});