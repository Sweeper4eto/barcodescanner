import test from "node:test";
import assert from "node:assert/strict";

function getPreviousScanStep(step: "scan" | "qty" | "date" | "missing") {
  switch (step) {
    case "date":
      return "qty";
    case "qty":
    case "missing":
      return "scan";
    default:
      return null;
  }
}

function getPreviousAddProductStep(
  step: "scan" | "name" | "photo" | "confirm",
  initialBarcode: string,
) {
  switch (step) {
    case "confirm":
      return "photo";
    case "photo":
      return "name";
    case "name":
      return initialBarcode ? null : "scan";
    default:
      return null;
  }
}

test("scan wizard previous step mapping", () => {
  assert.equal(getPreviousScanStep("date"), "qty");
  assert.equal(getPreviousScanStep("qty"), "scan");
  assert.equal(getPreviousScanStep("missing"), "scan");
  assert.equal(getPreviousScanStep("scan"), null);
});

test("add-product wizard previous step mapping", () => {
  assert.equal(getPreviousAddProductStep("confirm", ""), "photo");
  assert.equal(getPreviousAddProductStep("name", ""), "scan");
  assert.equal(getPreviousAddProductStep("name", "123"), null);
  assert.equal(getPreviousAddProductStep("scan", ""), null);
});
