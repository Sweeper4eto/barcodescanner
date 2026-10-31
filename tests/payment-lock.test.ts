import assert from "node:assert/strict";
import test from "node:test";
import { isPathAllowedWhenPaymentLocked } from "../src/lib/payment-lock";
import { isPaymentAccessBlocked } from "../src/lib/payment-status";

test("isPathAllowedWhenPaymentLocked allows billing and contact only", () => {
  assert.equal(isPathAllowedWhenPaymentLocked("/app/billing"), true);
  assert.equal(isPathAllowedWhenPaymentLocked("/app/billing/"), true);
  assert.equal(isPathAllowedWhenPaymentLocked("/app/contact"), true);
  assert.equal(isPathAllowedWhenPaymentLocked("/app/contact?topic=billing"), true);
  assert.equal(isPathAllowedWhenPaymentLocked("/app"), false);
  assert.equal(isPathAllowedWhenPaymentLocked("/app/expiry"), false);
  assert.equal(isPathAllowedWhenPaymentLocked("/app/team"), false);
});

test("isPaymentAccessBlocked after one fully unpaid prior month", () => {
  assert.equal(
    isPaymentAccessBlocked({
      homeUser: false,
      paymentsRequired: true,
      expectedAmount: 20,
      billingStart: { year: 2026, month: 9 },
      current: { year: 2026, month: 10 },
      paidKeys: new Set(),
    }),
    true,
  );

  assert.equal(
    isPaymentAccessBlocked({
      homeUser: false,
      paymentsRequired: true,
      expectedAmount: 20,
      billingStart: { year: 2026, month: 10 },
      current: { year: 2026, month: 10 },
      paidKeys: new Set(),
    }),
    false,
  );

  assert.equal(
    isPaymentAccessBlocked({
      homeUser: false,
      paymentsRequired: true,
      expectedAmount: 20,
      billingStart: { year: 2026, month: 9 },
      current: { year: 2026, month: 10 },
      paidKeys: new Set(["2026-9"]),
    }),
    false,
  );
});
