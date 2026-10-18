import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPIRY_EXPORT_MAX_ITEMS,
  downloadExpirySelectionJpg,
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
