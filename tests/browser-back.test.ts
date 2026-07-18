import test from "node:test";
import assert from "node:assert/strict";
import {
  getPreviousAddProductStep,
  getPreviousScanStep,
} from "../src/lib/wizard-steps";

test("scan wizard previous step mapping", () => {
  assert.equal(getPreviousScanStep("date", true), "qty");
  assert.equal(getPreviousScanStep("qty", true), "scan");
  assert.equal(getPreviousScanStep("qty", false), "name");
  assert.equal(getPreviousScanStep("missing", false), "scan");
  assert.equal(getPreviousScanStep("scan", false), null);
});

test("add-product wizard previous step mapping", () => {
  assert.equal(getPreviousAddProductStep("confirm", ""), "photo");
  assert.equal(getPreviousAddProductStep("name", ""), "scan");
  assert.equal(getPreviousAddProductStep("name", "123"), null);
  assert.equal(getPreviousAddProductStep("scan", ""), null);
});