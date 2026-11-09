import test from "node:test";
import assert from "node:assert/strict";
import {
  repairTruncatedItemsJson,
  wrapBareItemsArrayJson,
} from "../src/lib/document-ai";

test("wrapBareItemsArrayJson wraps a bare row array as {items:[...]}", () => {
  const raw = `[{"name":"A","quantity":1},{"name":"B","quantity":2}]`;
  const wrapped = wrapBareItemsArrayJson(raw);
  assert.equal(wrapped, `{"items":${raw}}`);
  const parsed = JSON.parse(wrapped);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].name, "A");
});

test("wrapBareItemsArrayJson leaves object-with-items unchanged", () => {
  const raw = `{"items":[{"name":"A","quantity":1}]}`;
  assert.equal(wrapBareItemsArrayJson(raw), raw);
});

test("repairTruncatedItemsJson closes cut-off items array", () => {
  const raw = `{"items":[{"name":"A","articul":"1","quantity":2},{"name":"B","articul":"2","quantity":`;
  const repaired = repairTruncatedItemsJson(raw);
  assert.ok(repaired);
  const parsed = JSON.parse(repaired!);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].name, "A");
});

test("repairTruncatedItemsJson keeps complete objects only", () => {
  const raw = `{"items":[{"name":"A","quantity":1},{"name":"B","quantity":2},{"name":"C"`;
  const repaired = repairTruncatedItemsJson(raw);
  assert.ok(repaired);
  const parsed = JSON.parse(repaired!);
  assert.equal(parsed.items.length, 2);
});
