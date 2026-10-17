/** Default € for a client's first location. */
export const DEFAULT_FIRST_LOCATION_FEE = 20;
/** Default € for 2nd, 3rd, … locations. */
export const DEFAULT_EXTRA_LOCATION_FEE = 15;
/** Suggested monthly discount € per active referred client. */
export const REFERRAL_DISCOUNT_EUR = 5;

/** Suggested payment discount from referral count (editable in admin). */
export function suggestedReferralDiscount(referralCount: number): number {
  const n = Math.max(0, Math.floor(Number(referralCount) || 0));
  return n * REFERRAL_DISCOUNT_EUR;
}

export function defaultFeeForLocationIndex(existingLocationCount: number): number {
  return existingLocationCount <= 0
    ? DEFAULT_FIRST_LOCATION_FEE
    : DEFAULT_EXTRA_LOCATION_FEE;
}

/** Sum monthly fees of active locations (or of an already-active-only list). */
export function sumLocationFees(
  stores: Array<{ monthlyFee: number; active?: boolean }>,
): number {
  return stores.reduce((sum, store) => {
    if (store.active === false) return sum;
    return sum + store.monthlyFee;
  }, 0);
}
