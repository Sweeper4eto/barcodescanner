import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  countUnpaidMonths,
  monthsInclusive,
  paymentStandingFromUnpaid,
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

  test("standing colors map unpaid counts", () => {
    assert.equal(
      paymentStandingFromUnpaid(0, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "current",
    );
    assert.equal(
      paymentStandingFromUnpaid(1, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "behind1",
    );
    assert.equal(
      paymentStandingFromUnpaid(2, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "behind2plus",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: true,
        paymentsRequired: true,
        expectedAmount: 40,
      }),
      "exempt",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: false,
        expectedAmount: 40,
      }),
      "current",
    );
    assert.equal(
      paymentStandingFromUnpaid(5, {
        homeUser: false,
        paymentsRequired: true,
        expectedAmount: 0,
      }),
      "current",
    );
  });

  test("sort rank puts red first", () => {
    assert.ok(standingSortRank("behind2plus") < standingSortRank("behind1"));
    assert.ok(standingSortRank("behind1") < standingSortRank("current"));
    assert.ok(standingSortRank("current") < standingSortRank("exempt"));
  });
});
