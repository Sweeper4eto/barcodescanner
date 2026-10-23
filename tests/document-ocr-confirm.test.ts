import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmSampleRowMatches,
  confirmSamplesMatch,
  normalizeConfirmName,
  pickConfirmSampleRows,
  toConfirmSample,
  type DocumentOcrRow,
} from "../src/lib/document-ai";

const row = (
  overrides: Partial<DocumentOcrRow> & Pick<DocumentOcrRow, "name">,
): DocumentOcrRow => ({
  barcode: null,
  articul: null,
  expiryYmd: "2027-01-01",
  quantity: 1,
  ...overrides,
});

describe("document OCR edge confirmation samples", () => {
  it("pickConfirmSampleRows takes top 3 and bottom 3 without overlap on long lists", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ name: `P${i}`, articul: String(i), quantity: i + 1 }),
    );
    const sample = pickConfirmSampleRows(rows);
    assert.deepEqual(
      sample.top.map((item) => item.name),
      ["P0", "P1", "P2"],
    );
    assert.deepEqual(
      sample.bottom.map((item) => item.name),
      ["P7", "P8", "P9"],
    );
  });

  it("pickConfirmSampleRows uses all rows as top when ≤3", () => {
    const sample = pickConfirmSampleRows([
      row({ name: "A" }),
      row({ name: "B" }),
    ]);
    assert.equal(sample.top.length, 2);
    assert.equal(sample.bottom.length, 0);
  });

  it("pickConfirmSampleRows splits mid-length pages without duplicating", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ name: `P${i}` }));
    const sample = pickConfirmSampleRows(rows);
    assert.deepEqual(
      sample.top.map((item) => item.name),
      ["P0", "P1", "P2"],
    );
    assert.deepEqual(
      sample.bottom.map((item) => item.name),
      ["P3", "P4"],
    );
  });

  it("normalizeConfirmName collapses punctuation and case", () => {
    assert.equal(
      normalizeConfirmName("Coca-Cola Zero, 2л"),
      normalizeConfirmName("coca cola zero 2л"),
    );
  });

  it("confirmSampleRowMatches requires qty and expiry equality", () => {
    const a = toConfirmSample(row({ name: "Milk", quantity: 2, expiryYmd: "2027-05-01" }));
    assert.equal(
      confirmSampleRowMatches(a, {
        ...a,
        name: "milk!!!",
      }),
      true,
    );
    assert.equal(
      confirmSampleRowMatches(a, { ...a, quantity: 3 }),
      false,
    );
    assert.equal(
      confirmSampleRowMatches(a, { ...a, expiryYmd: null }),
      false,
    );
    assert.equal(
      confirmSampleRowMatches(
        { ...a, expiryYmd: null },
        { ...a, expiryYmd: null },
      ),
      true,
    );
  });

  it("confirmSamplesMatch detects top/bottom drift", () => {
    const claimed = {
      top: [
        toConfirmSample(row({ name: "A", quantity: 1, expiryYmd: "2027-01-01" })),
        toConfirmSample(row({ name: "B", quantity: 2, expiryYmd: null })),
      ],
      bottom: [
        toConfirmSample(row({ name: "Y", quantity: 5, expiryYmd: "2028-01-01" })),
      ],
    };
    assert.equal(confirmSamplesMatch(claimed, claimed), true);
    assert.equal(
      confirmSamplesMatch(claimed, {
        top: claimed.top,
        bottom: [
          {
            name: "Y",
            articul: null,
            quantity: 5,
            expiryYmd: null,
          },
        ],
      }),
      false,
    );
    assert.equal(
      confirmSamplesMatch(claimed, {
        top: [claimed.top[0]],
        bottom: claimed.bottom,
      }),
      false,
    );
  });
});
