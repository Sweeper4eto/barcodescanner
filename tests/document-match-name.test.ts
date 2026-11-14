import test from "node:test";
import assert from "node:assert/strict";
import { pickDocumentDraftName } from "../src/lib/document-match";

test("pickDocumentDraftName prefers OCR name from the photo", () => {
  assert.equal(
    pickDocumentDraftName("Кисело мляко от фактура", "Catalog Milk"),
    "Кисело мляко от фактура",
  );
  assert.equal(pickDocumentDraftName("  OCR  ", "DB"), "OCR");
});

test("pickDocumentDraftName falls back to catalog when OCR name is missing", () => {
  assert.equal(pickDocumentDraftName("", "Catalog Milk"), "Catalog Milk");
  assert.equal(pickDocumentDraftName("   ", "Catalog Milk"), "Catalog Milk");
  assert.equal(pickDocumentDraftName(null, "Catalog Milk"), "Catalog Milk");
  assert.equal(pickDocumentDraftName(undefined, null), "");
});
