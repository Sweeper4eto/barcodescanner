import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDocumentExpiry,
  parsePrintedExpiry,
  repairTruncatedItemsJson,
  resolveDocumentExpiry,
} from "../src/lib/document-ai";

describe("parseDocumentExpiry", () => {
  it("parses ISO dates", () => {
    assert.equal(parseDocumentExpiry("2026-07-18"), "2026-07-18");
  });

  it("parses DMY with dots", () => {
    assert.equal(parseDocumentExpiry("18.07.2026"), "2026-07-18");
  });

  it("parses DMY with slashes and short year", () => {
    assert.equal(parseDocumentExpiry("5/1/26"), "2026-01-05");
  });

  it("returns null for empty or invalid", () => {
    assert.equal(parseDocumentExpiry(""), null);
    assert.equal(parseDocumentExpiry("n/a"), null);
  });

  it("accepts date with trailing lot/batch text", () => {
    assert.equal(parseDocumentExpiry("23.06.2027 L268623"), "2027-06-23");
    assert.equal(parseDocumentExpiry("2027-06-23 L268623"), "2027-06-23");
  });

  it("rejects impossible calendar dates", () => {
    assert.equal(parseDocumentExpiry("31.02.2026"), null);
    assert.equal(parseDocumentExpiry("2026-02-31"), null);
  });
});

describe("resolveDocumentExpiry", () => {
  it("prefers printed DD.MM.YYYY over swapped ISO month/day", () => {
    // Model often emits US order ISO for Bulgarian 01.12.2027
    assert.equal(
      resolveDocumentExpiry("2027-01-12", "01.12.2027"),
      "2027-12-01",
    );
  });

  it("keeps January 12 when printed says 12.01", () => {
    assert.equal(
      resolveDocumentExpiry("2026-12-01", "12.01.2026"),
      "2026-01-12",
    );
  });

  it("falls back to ISO when printed is missing", () => {
    assert.equal(resolveDocumentExpiry("2027-12-01", null), "2027-12-01");
  });

  it("ignores ISO-shaped values in the printed field", () => {
    assert.equal(
      resolveDocumentExpiry("2027-12-01", "2027-01-12"),
      "2027-12-01",
    );
  });
});

describe("parsePrintedExpiry", () => {
  it("always reads day first", () => {
    assert.equal(parsePrintedExpiry("01.12.2027"), "2027-12-01");
    assert.equal(parsePrintedExpiry("12.01.2027"), "2027-01-12");
  });
});

describe("repairTruncatedItemsJson", () => {
  it("reconstructs when the closing root brace is missing", () => {
    const raw = '{\n"items":[{"name":"A"},{"name":"B"}]';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("drops an incomplete trailing object", () => {
    const raw = '{"items":[{"name":"A"},{"name":"B"},{"name":"C';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("returns null when there is no complete object", () => {
    assert.equal(repairTruncatedItemsJson('{"items":[{"name":"A'), null);
  });
});
