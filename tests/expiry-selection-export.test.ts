import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPIRY_EXPORT_MAX_ITEMS,
  buildExpirySelectionSheetRows,
  downloadExpirySelectionJpg,
  downloadExpirySelectionXlsx,
  expiryExportDecision,
  type ExpiryExportLabels,
} from "../src/lib/expiry-selection-export";

test("expiry picture export allows 1 through 20 selected items", () => {
  assert.equal(EXPIRY_EXPORT_MAX_ITEMS, 20);
  assert.equal(expiryExportDecision(0), "empty");
  assert.equal(expiryExportDecision(1), "ok");
  assert.equal(expiryExportDecision(20), "ok");
  assert.equal(expiryExportDecision(21), "too-many");
});

test("expiry excel export can use a higher selection cap than pictures", () => {
  assert.equal(expiryExportDecision(21, 50), "ok");
  assert.equal(expiryExportDecision(51, 50), "too-many");
});

const labels: ExpiryExportLabels = {
  title: "Expiry",
  storeLine: "Home",
  addedPrefix: "Added",
  validUntil: "Until",
  pieces: "pcs",
  day: "day",
  days: "days",
  today: "Today",
  onlySelected: "Selected only",
};

test("expiry picture export does not run outside the browser", () => {
  assert.deepEqual(
    downloadExpirySelectionJpg({
      items: [
        {
          name: "Milk",
          enteredAt: "2026-10-01T00:00:00.000Z",
          expiryDate: "2026-10-20T00:00:00.000Z",
          quantity: 2,
        },
      ],
      labels,
      locale: "en-GB",
    }),
    { status: "failed" },
  );
  assert.equal(
    downloadExpirySelectionJpg({ items: [], labels, locale: "en-GB" }).status,
    "failed",
  );
});

test("expiry excel sheet rows include header and selected item fields", () => {
  const rows = buildExpirySelectionSheetRows(
    [
      {
        name: "Milk",
        articul: "A-1",
        lot: "L123",
        enteredAt: "2026-10-01T12:00:00.000Z",
        expiryDate: "2026-10-20T00:00:00.000Z",
        quantity: 2,
      },
    ],
    {
      name: "Name",
      articul: "SKU",
      lot: "Lot",
      quantity: "Qty",
      expiry: "Expiry",
      added: "Added",
      daysLeft: "Days left",
    },
    "en-GB",
  );
  assert.deepEqual(rows[0], [
    "Name",
    "SKU",
    "Lot",
    "Qty",
    "Expiry",
    "Added",
    "Days left",
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1]![0], "Milk");
  assert.equal(rows[1]![1], "A-1");
  assert.equal(rows[1]![2], "L123");
  assert.equal(rows[1]![3], "2");
  assert.match(rows[1]![4]!, /\d/);
  assert.match(rows[1]![6]!, /^-?\d+$/);
});

test("expiry excel download fails outside the browser", async () => {
  const result = await downloadExpirySelectionXlsx({
    items: [
      {
        name: "Milk",
        enteredAt: "2026-10-01T00:00:00.000Z",
        expiryDate: "2026-10-20T00:00:00.000Z",
        quantity: 1,
      },
    ],
    locale: "en-GB",
    columns: {
      name: "Name",
      articul: "SKU",
      lot: "Lot",
      quantity: "Qty",
      expiry: "Expiry",
      added: "Added",
      daysLeft: "Days left",
    },
  });
  assert.equal(result.status, "failed");
});
