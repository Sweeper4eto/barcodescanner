import assert from "node:assert/strict";
import test from "node:test";
import {
  listRevertStatus,
  parseAuditPayload,
  REVERTIBLE_EVENTS,
} from "../src/lib/audit-revert";

test("listRevertStatus marks legacy rows without payload", () => {
  assert.deepEqual(
    listRevertStatus({
      event: "inventory_removed",
      entityType: null,
      entityId: null,
      payloadJson: null,
      revertedAt: null,
    }),
    { revertible: false, revertBlockedReason: "legacy" },
  );
});

test("listRevertStatus allows soft removes with payload", () => {
  assert.deepEqual(
    listRevertStatus({
      event: "inventory_removed",
      entityType: "inventory_entry",
      entityId: "inv_1",
      payloadJson: JSON.stringify({ soft: true, quantity: 2 }),
      revertedAt: null,
    }),
    { revertible: true },
  );
});

test("listRevertStatus blocks hard deletes and already reverted", () => {
  assert.deepEqual(
    listRevertStatus({
      event: "inventory_removed",
      entityType: "inventory_entry",
      entityId: "inv_1",
      payloadJson: JSON.stringify({ soft: false }),
      revertedAt: null,
    }),
    { revertible: false, revertBlockedReason: "hard_deleted" },
  );

  assert.deepEqual(
    listRevertStatus({
      event: "buy_list_updated",
      entityType: "buy_list_entry",
      entityId: "bl_1",
      payloadJson: JSON.stringify({ beforeQty: 1, afterQty: 3 }),
      revertedAt: new Date("2026-11-01T00:00:00.000Z"),
    }),
    { revertible: false, revertBlockedReason: "already_reverted" },
  );
});

test("listRevertStatus rejects auth events", () => {
  assert.deepEqual(
    listRevertStatus({
      event: "login",
      entityType: null,
      entityId: null,
      payloadJson: null,
      revertedAt: null,
    }),
    { revertible: false, revertBlockedReason: "not_supported" },
  );
});

test("parseAuditPayload tolerates bad JSON", () => {
  assert.equal(parseAuditPayload("{"), null);
  assert.deepEqual(parseAuditPayload('{"quantity":2}'), { quantity: 2 });
});

test("REVERTIBLE_EVENTS covers inventory and buy-list mutations", () => {
  assert.ok(REVERTIBLE_EVENTS.includes("inventory_updated"));
  assert.ok(REVERTIBLE_EVENTS.includes("buy_list_removed"));
  assert.ok(!REVERTIBLE_EVENTS.includes("login" as never));
});
