import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDocumentExpiry,
  repairTruncatedItemsJson,
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

  it("rejects impossible calendar dates", () => {
    assert.equal(parseDocumentExpiry("31.02.2026"), null);
    assert.equal(parseDocumentExpiry("2026-02-31"), null);
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