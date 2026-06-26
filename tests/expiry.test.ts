import test from "node:test";
import assert from "node:assert/strict";
import {
  expiryListVisible,
  expiryUrgencyClass,
  paymentAmount,
} from "../src/lib/expiry";

test("paymentAmount subtracts discount and floors at zero", () => {
  assert.equal(paymentAmount(5, 10, 3), 47);
  assert.equal(paymentAmount(2, 10, 25), 0);
});

test("expiryListVisible hides far-future and very old expiry", () => {
  const now = new Date("2026-06-01");
  const inFiveWeeks = new Date("2026-07-08");
  const inThreeWeeks = new Date("2026-06-22");
  const eightMonthsAgo = new Date("2025-10-01");

  assert.equal(expiryListVisible(inFiveWeeks, now), false);
  assert.equal(expiryListVisible(inThreeWeeks, now), true);
  assert.equal(expiryListVisible(eightMonthsAgo, now), false);
});

test("expiryUrgencyClass colors by days remaining", () => {
  const now = new Date("2026-06-01");
  assert.equal(expiryUrgencyClass(new Date("2026-06-05"), now), "urgency-critical");
  assert.equal(expiryUrgencyClass(new Date("2026-06-12"), now), "urgency-warning");
  assert.equal(expiryUrgencyClass(new Date("2026-06-20"), now), "urgency-soon");
});
