import test from "node:test";
import assert from "node:assert/strict";
import { auditAuthLoginFailed } from "../src/lib/audit-details";
import {
  OWNER_ACTIVITY_EVENTS,
  auditDetailsHasPositiveWriteOff,
  auditStoreDetailsNeedle,
  buildAuditLogWhere,
} from "../src/lib/audit-log";

test("auditStoreDetailsNeedle matches audit detail format", () => {
  assert.equal(auditStoreDetailsNeedle("1030"), 'store "1030"');
  assert.equal(auditStoreDetailsNeedle("  Main  "), 'store "Main"');
});

test("buildAuditLogWhere filters by username store and ip", () => {
  const where = buildAuditLogWhere({
    username: "dayana",
    store: "1030",
    ip: "149.62",
  });

  assert.deepEqual(where, {
    AND: [
      { username: { equals: "dayana" } },
      { details: { contains: 'store "1030"' } },
      { ipAddress: { contains: "149.62" } },
    ],
  });
});

test("buildAuditLogWhere filters inventory added and removed", () => {
  const added = buildAuditLogWhere({ filter: "inventory_added" });
  assert.deepEqual(added, {
    AND: [{ event: { in: ["inventory_added", "inventory_merged"] } }],
  });

  const removed = buildAuditLogWhere({ filter: "inventory_removed" });
  assert.deepEqual(removed, {
    AND: [{ event: { in: ["inventory_removed"] } }],
  });
});

test("buildAuditLogWhere filters write-offs via details", () => {
  const where = buildAuditLogWhere({ filter: "inventory_write_off" });
  assert.ok(where.AND);
  const clauses = where.AND as Array<Record<string, unknown>>;
  assert.deepEqual(clauses[0], { event: { in: ["inventory_removed"] } });
  const detailsOr = clauses[1] as { OR: Array<{ details: { contains: string } }> };
  assert.equal(detailsOr.OR.length, 9);
  assert.equal(detailsOr.OR[0]?.details.contains, "write-off 1");
  assert.equal(detailsOr.OR[8]?.details.contains, "write-off 9");
});

test("auditDetailsHasPositiveWriteOff", () => {
  assert.equal(auditDetailsHasPositiveWriteOff('qty 2; write-off 0; store "A"'), false);
  assert.equal(auditDetailsHasPositiveWriteOff('qty 2; write-off 2; store "A"'), true);
  assert.equal(auditDetailsHasPositiveWriteOff('qty 2; write-off 10; store "A"'), true);
  assert.equal(auditDetailsHasPositiveWriteOff('qty 2; store "A"'), false);
});

test("buildAuditLogWhere filters by client via user relation", () => {
  const where = buildAuditLogWhere({
    clientId: "client_1",
  });

  assert.deepEqual(where, {
    AND: [{ user: { clientId: "client_1" } }],
  });
});

test("buildAuditLogWhere filters business accounts by homeUser false", () => {
  const where = buildAuditLogWhere({
    accountKind: "business",
  });

  assert.deepEqual(where, {
    AND: [{ user: { client: { homeUser: false } } }],
  });
});

test("buildAuditLogWhere filters household accounts by homeUser true", () => {
  const where = buildAuditLogWhere({
    accountKind: "household",
  });

  assert.deepEqual(where, {
    AND: [{ user: { client: { homeUser: true } } }],
  });
});

test("buildAuditLogWhere prefers clientId over accountKind", () => {
  const where = buildAuditLogWhere({
    accountKind: "household",
    clientId: "client_1",
  });

  assert.deepEqual(where, {
    AND: [{ user: { clientId: "client_1" } }],
  });
});

test("buildAuditLogWhere combines client and username", () => {
  const where = buildAuditLogWhere({
    clientId: "client_1",
    username: "emanuela",
  });

  assert.deepEqual(where, {
    AND: [
      { user: { clientId: "client_1" } },
      { username: { equals: "emanuela" } },
    ],
  });
});

test("buildAuditLogWhere applies event group; free text q is handled in queryAuditLog", () => {
  const where = buildAuditLogWhere({
    filter: "inventory",
    q: "Milk",
  });

  assert.ok(where.AND);
  const and = where.AND as Array<Record<string, unknown>>;
  assert.ok(and.some((clause) => "event" in clause));
  // Unicode-aware free-text match runs in queryAuditLog, not here.
  assert.ok(!and.some((clause) => "OR" in clause));
});

test("buildAuditLogWhere intersects filter with owner activity allowlist", () => {
  const where = buildAuditLogWhere({
    filter: "auth",
    clientId: "client_1",
    eventsAllowlist: OWNER_ACTIVITY_EVENTS,
  });

  assert.ok(where.AND);
  const and = where.AND as Array<Record<string, unknown>>;
  const eventClause = and.find((clause) => "event" in clause) as {
    event: { in: string[] };
  };
  assert.ok(eventClause);
  assert.ok(eventClause.event.in.includes("login"));
  assert.ok(!eventClause.event.in.includes("payment_recorded"));
  assert.ok(OWNER_ACTIVITY_EVENTS.includes("login"));
  assert.ok(!OWNER_ACTIVITY_EVENTS.includes("payment_recorded"));
  assert.ok(!OWNER_ACTIVITY_EVENTS.includes("login_failed"));
});

test("auditAuthLoginFailed keeps typed casing and never invents secrets", () => {
  assert.equal(
    auditAuthLoginFailed({ reason: "invalid credentials", typedUsername: "Irina" }),
    'invalid credentials · typed "Irina"',
  );
  assert.equal(
    auditAuthLoginFailed({ reason: "locked", typedUsername: "irina" }),
    "locked",
  );
});

test("auth filter includes login_failed", () => {
  const where = buildAuditLogWhere({ filter: "auth" });
  assert.ok(where.AND);
  const and = where.AND as Array<Record<string, unknown>>;
  const eventClause = and.find((clause) => "event" in clause) as {
    event: { in: string[] };
  };
  assert.ok(eventClause.event.in.includes("login_failed"));
});
