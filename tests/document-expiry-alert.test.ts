import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findLongExpiredDocumentRows,
  oneMonthBeforeYmd,
} from "../src/lib/document-expiry-alert";
import type { DocumentOcrRow } from "../src/lib/document-ai";

function row(name: string, expiryYmd: string | null): DocumentOcrRow {
  return { name, barcode: null, articul: null, expiryYmd, quantity: 1 };
}

describe("document expiry alert", () => {
  it("oneMonthBeforeYmd steps back one calendar month", () => {
    assert.equal(oneMonthBeforeYmd("2026-10-24"), "2026-09-24");
    assert.equal(oneMonthBeforeYmd("2026-01-15"), "2025-12-15");
    assert.equal(oneMonthBeforeYmd("2026-03-31"), "2026-02-28");
    assert.equal(oneMonthBeforeYmd("2028-03-31"), "2028-02-29");
  });

  it("flags only rows expired more than one month before the scan day", () => {
    // 24 Oct 2026 12:00 in Sofia → cutoff 2026-09-24
    const now = new Date("2026-10-24T09:00:00Z");
    const flagged = findLongExpiredDocumentRows(
      [
        row("Ariana", "2026-01-30"),
        row("Old bread", "2026-09-23"),
        row("Exactly one month", "2026-09-24"),
        row("Last week", "2026-10-17"),
        row("Future", "2027-08-30"),
        row("No date", null),
      ],
      now,
    );
    assert.deepEqual(
      flagged.map((item) => item.name),
      ["Ariana", "Old bread"],
    );
  });

  it("uses the Sofia calendar day, not UTC", () => {
    // 23:30 UTC on 23 Oct is already 24 Oct in Sofia → cutoff 2026-09-24
    const now = new Date("2026-10-23T23:30:00Z");
    const flagged = findLongExpiredDocumentRows([row("Edge", "2026-09-23")], now);
    assert.equal(flagged.length, 1);
  });
});
