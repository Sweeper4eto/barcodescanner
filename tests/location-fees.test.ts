import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countQualifyingReferrals,
  defaultFeeForLocationIndex,
  expectedPaymentAmount,
  isQualifyingReferral,
  suggestedReferralDiscount,
  sumLocationFees,
} from "../src/lib/location-fees";
import { paymentAmount } from "../src/lib/expiry";

describe("location fees", () => {
  it("defaults first location to 20 and extras to 15", () => {
    assert.equal(defaultFeeForLocationIndex(0), 20);
    assert.equal(defaultFeeForLocationIndex(1), 15);
    assert.equal(defaultFeeForLocationIndex(5), 15);
  });

  it("sums only active location fees", () => {
    assert.equal(
      sumLocationFees([
        { monthlyFee: 20, active: true },
        { monthlyFee: 15, active: true },
        { monthlyFee: 15, active: false },
      ]),
      35,
    );
  });

  it("builds expected payment from fee sum", () => {
    assert.equal(paymentAmount(sumLocationFees([{ monthlyFee: 20 }, { monthlyFee: 15 }]), 5), 30);
  });

  it("applies €5 per referral to expected amount due", () => {
    assert.equal(suggestedReferralDiscount(2), 10);
    assert.equal(expectedPaymentAmount(65, 2), 55);
    assert.equal(expectedPaymentAmount(20, 0), 20);
  });

  it("counts only active referrals with active locations", () => {
    assert.equal(
      isQualifyingReferral({
        active: true,
        stores: [{ active: true }],
      }),
      true,
    );
    assert.equal(
      isQualifyingReferral({
        active: true,
        stores: [{ active: false }],
      }),
      false,
    );
    assert.equal(
      isQualifyingReferral({
        active: false,
        stores: [{ active: true }],
      }),
      false,
    );
    assert.equal(
      countQualifyingReferrals([
        { active: true, stores: [{ active: true }] },
        { active: true, stores: [{ active: false }] },
        { active: false, stores: [{ active: true }] },
        { active: true, stores: [{ active: true }, { active: false }] },
      ]),
      2,
    );
  });
});
