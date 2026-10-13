import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_ACTIVITY_EVENTS,
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

test("buildAuditLogWhere combines event group with free text", () => {
  const where = buildAuditLogWhere({
    filter: "inventory",
    q: "Milk",
  });

  assert.ok(where.AND);
  const and = where.AND as Array<Record<string, unknown>>;
  assert.ok(and.some((clause) => "event" in clause));
  assert.ok(and.some((clause) => "OR" in clause));
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
});
