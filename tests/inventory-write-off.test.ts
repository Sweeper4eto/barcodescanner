import test from "node:test";
import assert from "node:assert/strict";
import { clampWriteOffQuantity } from "../src/lib/inventory-write-off";
import { auditInventoryRemoved } from "../src/lib/audit-details";

test("clampWriteOffQuantity stays within 0…quantity", () => {
  assert.equal(clampWriteOffQuantity(3, 5), 3);
  assert.equal(clampWriteOffQuantity(0, 5), 0);
  assert.equal(clampWriteOffQuantity(9, 5), 5);
  assert.equal(clampWriteOffQuantity(-2, 5), 0);
  assert.equal(clampWriteOffQuantity(2.9, 5), 2);
  assert.equal(clampWriteOffQuantity(Number.NaN, 5), 0);
});

test("auditInventoryRemoved includes write-off when set", () => {
  const withOff = auditInventoryRemoved({
    productName: "Мляко",
    barcode: "3800123456789",
    quantity: 4,
    storeName: "Main",
    expiryDate: new Date("2026-11-20T00:00:00.000Z"),
    writeOffQuantity: 2,
  });
  assert.match(withOff, /qty 4/);
  assert.match(withOff, /write-off 2/);

  const without = auditInventoryRemoved({
    productName: "Мляко",
    barcode: "3800123456789",
    quantity: 4,
    storeName: "Main",
    expiryDate: new Date("2026-11-20T00:00:00.000Z"),
  });
  assert.doesNotMatch(without, /write-off/);
});
