import test from "node:test";
import assert from "node:assert/strict";
import {
  BarcodeReadConsensus,
  barcodeLookupValues,
  isPlausibleBarcode,
  normalizeBarcode,
} from "../src/lib/barcode";

test("isPlausibleBarcode validates EAN-13 checksum", () => {
  assert.equal(isPlausibleBarcode("4006381333931"), true);
  assert.equal(isPlausibleBarcode("4006381333930"), false);
});

test("isPlausibleBarcode validates UPC-A checksum", () => {
  assert.equal(isPlausibleBarcode("036000291452"), true);
  assert.equal(isPlausibleBarcode("036000291453"), false);
});

test("BarcodeReadConsensus requires repeated identical reads", () => {
  const consensus = new BarcodeReadConsensus();
  assert.equal(consensus.add("4006381333931"), null);
  assert.equal(consensus.add("4006381333931"), "4006381333931");
  assert.equal(consensus.add("4006381333931"), null);
});

test("BarcodeReadConsensus rejects invalid checksum immediately", () => {
  const consensus = new BarcodeReadConsensus();
  assert.equal(consensus.add("4006381333930"), null);
  assert.equal(consensus.add("4006381333930"), null);
});

test("normalizeBarcode trims whitespace", () => {
  assert.equal(normalizeBarcode("  12345678  "), "12345678");
});

test("normalizeBarcode pads 12-digit UPC-A to EAN-13", () => {
  assert.equal(normalizeBarcode("400229340110"), "0400229340110");
  assert.equal(normalizeBarcode("0400229340110"), "0400229340110");
});

test("normalizeBarcode keeps 12-digit codes that already start with zero", () => {
  assert.equal(normalizeBarcode("014300398484"), "014300398484");
});

test("barcodeLookupValues includes UPC and EAN forms", () => {
  const values = barcodeLookupValues("400229340110");
  assert.ok(values.includes("400229340110"));
  assert.ok(values.includes("0400229340110"));
});
