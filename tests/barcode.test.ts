import test from "node:test";
import assert from "node:assert/strict";
import {
  BarcodeReadConsensus,
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
  const consensus = new BarcodeReadConsensus(3);
  assert.equal(consensus.add("4006381333931"), null);
  assert.equal(consensus.add("4006381333931"), null);
  assert.equal(consensus.add("4006381333931"), "4006381333931");
  assert.equal(consensus.add("4006381333931"), null);
});

test("BarcodeReadConsensus rejects invalid checksum immediately", () => {
  const consensus = new BarcodeReadConsensus(2);
  assert.equal(consensus.add("4006381333930"), null);
  assert.equal(consensus.add("4006381333930"), null);
});

test("normalizeBarcode trims whitespace", () => {
  assert.equal(normalizeBarcode("  12345678  "), "12345678");
});
