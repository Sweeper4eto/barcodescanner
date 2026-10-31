import { paymentAmount } from "@/lib/expiry";

/** Default € for a client's first location. */
export const DEFAULT_FIRST_LOCATION_FEE = 20;
/** Default € for 2nd, 3rd, … locations. */
export const DEFAULT_EXTRA_LOCATION_FEE = 15;
/** Monthly discount € per qualifying referred client. */
export const REFERRAL_DISCOUNT_EUR = 5;

/**
 * Prisma filter for referrals that earn a discount:
 * referred account is active and has at least one active location.
 */
export const qualifyingReferralWhere = {
  active: true,
  stores: { some: { active: true } },
} as const;

/** Include shape for counting qualifying referrals in app code (not only `_count`). */
export const qualifyingReferralInclude = {
  where: qualifyingReferralWhere,
  select: { id: true },
} as const;

/**
 * True when a loaded referral earns the discount.
 * If `stores` is omitted, the list is assumed already filtered.
 */
export function isQualifyingReferral(referral: {
  active?: boolean;
  stores?: Array<{ active?: boolean }>;
}): boolean {
  if (referral.active === false) return false;
  if (!referral.stores) return true;
  return referral.stores.some((store) => store.active !== false);
}

/** Count referrals that earn the discount from an already-loaded list. */
export function countQualifyingReferrals(
  referrals: Array<{
    active?: boolean;
    stores?: Array<{ active?: boolean }>;
  }>,
): number {
  return referrals.filter(isQualifyingReferral).length;
}

/** Discount € from qualifying referral count (editable when admin marks paid). */
export function suggestedReferralDiscount(referralCount: number): number {
  const n = Math.max(0, Math.floor(Number(referralCount) || 0));
  return n * REFERRAL_DISCOUNT_EUR;
}

/**
 * Amount due for the month: active location fees minus referral discount.
 * Admin can still record a different discount when marking paid.
 */
export function expectedPaymentAmount(
  locationsFeeTotal: number,
  referralCount: number,
): number {
  return paymentAmount(
    locationsFeeTotal,
    suggestedReferralDiscount(referralCount),
  );
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
