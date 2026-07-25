import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLikelyInvalidBarcode,
  isLikelyNameFragment,
  looksLikeEan,
  repairFragmentRowAlignment,
  sanitizeDocumentRow,
  sanitizeDocumentRows,
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

describe("repairFragmentRowAlignment", () => {
  it("detects single-word leftovers without sku/barcode as fragments", () => {
    assert.equal(
      isLikelyNameFragment({
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: "2026-08-12",
        quantity: 24,
      }),
      true,
    );
    assert.equal(
      isLikelyNameFragment({
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "12345",
        expiryYmd: "2026-08-12",
        quantity: 24,
      }),
      false,
    );
  });

  it("drops a leftover above a real product without touching that product's fields", () => {
    const repaired = repairFragmentRowAlignment([
      {
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
      {
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "88112",
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Сок манго 1л",
        barcode: null,
        articul: "99001",
        expiryYmd: "2026-09-01",
        quantity: 6,
      },
    ]);

    assert.equal(repaired.length, 2);
    assert.equal(repaired[0].name, "Бъбъл чай SIMPATICO праскова 320мл");
    assert.equal(repaired[0].quantity, 1);
    assert.equal(repaired[0].expiryYmd, null);
    assert.equal(repaired[1].expiryYmd, "2026-09-01");
  });

  it("never moves qty or expiry between neighboring real products", () => {
    const input = [
      {
        name: "Product without date on page 2",
        barcode: null,
        articul: "1001",
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Product with its own date",
        barcode: null,
        articul: "1002",
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
    ];
    const repaired = repairFragmentRowAlignment(input);
    assert.deepEqual(repaired, input);
    const sanitized = sanitizeDocumentRows(input);
    assert.equal(sanitized[0].expiryYmd, null);
    assert.equal(sanitized[1].expiryYmd, "2026-08-12");
    assert.equal(sanitized[1].quantity, 24);
  });

  it("does not disturb a real short product that has its own sku", () => {
    const input = [
      {
        name: "Мляко",
        barcode: null,
        articul: "1001",
        expiryYmd: "2026-05-01",
        quantity: 2,
      },
      {
        name: "Хляб бял",
        barcode: null,
        articul: "1002",
        expiryYmd: "2026-05-02",
        quantity: 4,
      },
    ];
    assert.deepEqual(repairFragmentRowAlignment(input), input);
  });

  it("sanitizeDocumentRows drops orphan single-word crumbs with no date", () => {
    const rows = sanitizeDocumentRows([
      {
        name: "Праскова",
        barcode: null,
        articul: null,
        expiryYmd: null,
        quantity: 1,
      },
      {
        name: "Бъбъл чай SIMPATICO праскова 320мл",
        barcode: null,
        articul: "88112",
        expiryYmd: "2026-08-12",
        quantity: 24,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Бъбъл чай SIMPATICO праскова 320мл");
  });
});
