import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  billingStartPeriod,
  countStandingUnpaidMonths,
  countUnpaidMonths,
  hasOverdueUnpaidMonths,
  isPaymentAccessBlocked,
  monthsInclusive,
  paymentStandingFromUnpaid,
  periodFromDate,
  periodKey,
  standingSortRank,
} from "../src/lib/payment-status";

describe("payment standing", () => {
  test("monthsInclusive spans year boundary", () => {
    assert.deepEqual(
      monthsInclusive({ year: 2025, month: 11 }, { year: 2026, month: 2 }),
      [
        { year: 2025, month: 11 },
        { year: 2025, month: 12 },
        { year: 2026, month: 1 },
        { year: 2026, month: 2 },
      ],
    );
  });

  test("countUnpaidMonths ignores paid months", () => {
    const unpaid = countUnpaidMonths({
      billingStart: { year: 2026, month: 1 },
      through: { year: 2026, month: 3 },
      paidKeys: new Set([periodKey(2026, 1), periodKey(2026, 3)]),
    });
    assert.equal(unpaid, 1);
  });

  test("standing maps past unpaid and current-month due", () => {
    const base = {
      homeUser: false,
      paymentsRequired: true,
      expectedAmount: 40,
    };
    assert.equal(
      paymentStandingFromUnpaid(0, { ...base, currentMonthPaid: true }),
      "current",
    );
    assert.equal(
      paymentStandingFromUnpaid(0, { ...base, currentMonthPaid: false }),
      "due",
    );
    assert.equal(
      paymentStandingFromUnpaid(1, { ...base, currentMonthPaid: false }),
      "behind1",
    );
    assert.equal(
      paymentStandingFromUnpaid(2, { ...base, currentMonthPaid: false }),
      "behind2plus",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: true,
        paymentsRequired: true,
        expectedAmount: 40,
        currentMonthPaid: false,
      }),
      "exempt",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: false,
        expectedAmount: 40,
        currentMonthPaid: false,
      }),
      "exempt",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 0,
        currentMonthPaid: false,
      }),
      "exempt",
    );
  });

  test("standing unpaid ignores current month for overdue count", () => {
    assert.equal(
      countStandingUnpaidMonths({
        billingStart: { year: 2026, month: 11 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      0,
    );
    assert.equal(
      paymentStandingFromUnpaid(0, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
        currentMonthPaid: false,
      }),
      "due",
    );
  });

  test("standing unpaid counts past month only when current also open", () => {
    assert.equal(
      countStandingUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      1,
    );
    assert.equal(
      countStandingUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set([periodKey(2026, 10)]),
      }),
      0,
    );
  });

  test("sort rank puts overdue first then due then current", () => {
    assert.ok(standingSortRank("behind2plus") < standingSortRank("behind1"));
    assert.ok(standingSortRank("behind1") < standingSortRank("due"));
    assert.ok(standingSortRank("due") < standingSortRank("current"));
    assert.ok(standingSortRank("current") < standingSortRank("exempt"));
  });

  test("billing month uses Europe/Sofia, not UTC server local", () => {
    // 2026-10-31 22:30 UTC = 2026-11-01 00:30 in Sofia
    const sofiaAlreadyNovember = new Date("2026-10-31T22:30:00.000Z");
    assert.deepEqual(periodFromDate(sofiaAlreadyNovember), {
      year: 2026,
      month: 11,
    });
    // Still October in Sofia
    const sofiaStillOctober = new Date("2026-10-31T20:30:00.000Z");
    assert.deepEqual(periodFromDate(sofiaStillOctober), {
      year: 2026,
      month: 10,
    });
  });
});

describe("payment overdue lock", () => {
  test("billingStartPeriod uses paymentsRequiredSince when set", () => {
    const start = billingStartPeriod({
      paymentsRequired: true,
      paymentsRequiredSince: new Date("2026-10-01T12:00:00.000Z"),
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
      now: new Date("2026-10-15T12:00:00.000Z"),
    });
    assert.deepEqual(start, { year: 2026, month: 10 });
  });

  test("billingStartPeriod repairs UTC skew for new payers", () => {
    // Stored as October 1st, but account was written after Sofia rolled to November.
    const start = billingStartPeriod({
      paymentsRequired: true,
      paymentsRequiredSince: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-31T22:30:00.000Z"), // Nov 1 Sofia
      now: new Date("2026-10-31T22:30:00.000Z"),
    });
    assert.deepEqual(start, { year: 2026, month: 11 });
  });

  test("billingStartPeriod keeps real prior-month starts", () => {
    // Enabled in October (updatedAt still October) — still owes from October.
    const start = billingStartPeriod({
      paymentsRequired: true,
      paymentsRequiredSince: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-10-15T12:00:00.000Z"),
      now: new Date("2026-11-01T12:00:00.000Z"),
    });
    assert.deepEqual(start, { year: 2026, month: 10 });
  });

  test("billingStartPeriod is null when payments off", () => {
    assert.equal(
      billingStartPeriod({
        paymentsRequired: false,
        paymentsRequiredSince: null,
        createdAt: new Date(2026, 0, 1),
      }),
      null,
    );
  });

  test("no overdue in the first billed month even if unpaid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 10 },
        paidKeys: new Set(),
      }),
      false,
    );
  });

  test("overdue on the 1st of the following month if previous unpaid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      true,
    );
  });

  test("no overdue next month once previous month is paid", () => {
    assert.equal(
      hasOverdueUnpaidMonths({
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set([periodKey(2026, 10)]),
      }),
      false,
    );
  });

  test("access stays open for current-month-only unpaid", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 10 },
        paidKeys: new Set(),
      }),
      false,
    );
  });

  test("access blocks when a past billed month is unpaid", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      true,
    );
  });

  test("access ignores payments-off and zero fee", () => {
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: false,
        expectedAmount: 40,
        billingStart: null,
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      false,
    );
    assert.equal(
      isPaymentAccessBlocked({
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 0,
        billingStart: { year: 2026, month: 10 },
        current: { year: 2026, month: 11 },
        paidKeys: new Set(),
      }),
      false,
    );
  });
});
