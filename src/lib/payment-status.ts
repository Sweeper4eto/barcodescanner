export type BillingPeriod = { year: number; month: number };

/**
 * Billing calendar (amount due, standing, lock) uses Bulgaria time, not server UTC.
 * Otherwise late evening / early morning around month boundaries mis-labels “this month”.
 */
export const BILLING_TIME_ZONE = "Europe/Sofia";

/**
 * - current: this month paid, no past unpaid
 * - due: this month still open (not overdue / not locked)
 * - behind1: 1 past billed month unpaid (locked)
 * - behind2plus: 2+ past billed months unpaid (locked)
 * - exempt: household / payments off / nothing to collect
 */
export type PaymentStanding =
  | "current"
  | "due"
  | "behind1"
  | "behind2plus"
  | "exempt";

export function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function comparePeriods(a: BillingPeriod, b: BillingPeriod): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function addMonths(period: BillingPeriod, delta: number): BillingPeriod {
  const index = period.year * 12 + (period.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return { year, month };
}

/** Calendar year/month in the billing timezone (default Europe/Sofia). */
export function periodFromDate(
  date: Date,
  timeZone: string = BILLING_TIME_ZONE,
): BillingPeriod {
  const ymd = date.toLocaleDateString("en-CA", { timeZone });
  const [yearText, monthText] = ymd.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  }
  return { year, month };
}

/**
 * First moment of the billing month in UTC (noon UTC on the 1st), so storing /
 * reading the date does not slip into the previous Sofia calendar month.
 */
export function startOfBillingMonth(
  date = new Date(),
  timeZone: string = BILLING_TIME_ZONE,
): Date {
  const { year, month } = periodFromDate(date, timeZone);
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

/**
 * First month that counts toward unpaid standing / overdue lock.
 * Prefer paymentsRequiredSince; fall back to createdAt for legacy rows.
 *
 * Also repairs UTC month-start skew: payments turned on just after Sofia
 * midnight can be stored as the previous month's 1st (server still on UTC).
 * If the row was last written in the current Sofia month and the stored start
 * is exactly the previous month, billing starts this month instead — so new
 * payers are not charged for the prior month.
 */
export function billingStartPeriod(options: {
  paymentsRequired: boolean;
  paymentsRequiredSince: Date | null | undefined;
  createdAt: Date;
  /** Client.updatedAt — used to detect “enabled this Sofia month” skew. */
  updatedAt?: Date | null;
  now?: Date;
}): BillingPeriod | null {
  if (!options.paymentsRequired) return null;
  const since = options.paymentsRequiredSince ?? options.createdAt;
  const now = options.now ?? new Date();
  const start = periodFromDate(since);
  const current = periodFromDate(now);
  if (comparePeriods(start, current) >= 0) return start;

  const updatedAt = options.updatedAt;
  if (!updatedAt) return start;

  const updated = periodFromDate(updatedAt);
  const previous = addMonths(current, -1);
  if (
    comparePeriods(updated, current) === 0 &&
    comparePeriods(start, previous) === 0
  ) {
    return current;
  }
  return start;
}

/** True when stored paymentsRequiredSince should be advanced to the Sofia month start. */
export function needsPaymentsRequiredSinceRepair(options: {
  paymentsRequired: boolean;
  paymentsRequiredSince: Date | null | undefined;
  createdAt: Date;
  updatedAt?: Date | null;
  now?: Date;
}): boolean {
  if (!options.paymentsRequired || !options.paymentsRequiredSince) return false;
  const raw = periodFromDate(options.paymentsRequiredSince);
  const effective = billingStartPeriod(options);
  return effective != null && comparePeriods(raw, effective) < 0;
}

/** Inclusive list of calendar months from start through end. */
export function monthsInclusive(
  start: BillingPeriod,
  end: BillingPeriod,
): BillingPeriod[] {
  if (comparePeriods(start, end) > 0) return [];
  const months: BillingPeriod[] = [];
  let cursor = start;
  while (comparePeriods(cursor, end) <= 0) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/**
 * Count months since billing start through `through` that have no payment.
 * One payment covers the whole client (all locations).
 */
export function countUnpaidMonths(options: {
  billingStart: BillingPeriod;
  through: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): number {
  const months = monthsInclusive(options.billingStart, options.through);
  let unpaid = 0;
  for (const period of months) {
    if (!options.paidKeys.has(periodKey(period.year, period.month))) {
      unpaid += 1;
    }
  }
  return unpaid;
}

/**
 * Unpaid months that affect standing / overdue (past months only).
 * Current calendar month may stay open without counting as behind.
 * Example: billing starts Nov → Nov unpaid → 0; Oct unpaid in Nov → 1.
 */
export function countStandingUnpaidMonths(options: {
  billingStart: BillingPeriod;
  current: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): number {
  const through = addMonths(options.current, -1);
  if (comparePeriods(options.billingStart, through) > 0) {
    return 0;
  }
  return countUnpaidMonths({
    billingStart: options.billingStart,
    through,
    paidKeys: options.paidKeys,
  });
}

/**
 * True when any billed month *before* the current month is still unpaid.
 * Current month may stay unpaid without locking (pay anytime this month).
 * Example: payments on from Oct → lock starts Nov 1 if Oct is unpaid.
 */
export function hasOverdueUnpaidMonths(options: {
  billingStart: BillingPeriod;
  current: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): boolean {
  return countStandingUnpaidMonths(options) > 0;
}

/** Pure access gate used by clientRequiresPayment. */
export function isPaymentAccessBlocked(options: {
  homeUser: boolean;
  paymentsRequired: boolean;
  expectedAmount: number;
  billingStart: BillingPeriod | null;
  current: BillingPeriod;
  paidKeys: ReadonlySet<string>;
}): boolean {
  if (
    options.homeUser ||
    !options.paymentsRequired ||
    options.expectedAmount <= 0 ||
    !options.billingStart
  ) {
    return false;
  }
  return hasOverdueUnpaidMonths({
    billingStart: options.billingStart,
    current: options.current,
    paidKeys: options.paidKeys,
  });
}

export function paymentStandingFromUnpaid(
  /** Past billed months still unpaid (excludes the current calendar month). */
  pastUnpaidMonths: number,
  options: {
    homeUser: boolean;
    paymentsRequired: boolean;
    expectedAmount: number;
    /** When false, current month still needs payment (shows as due if not behind). */
    currentMonthPaid: boolean;
  },
): PaymentStanding {
  if (options.homeUser) return "exempt";
  // Payments off, or nothing to collect → yellow (exempt), not paid-up green.
  if (!options.paymentsRequired || options.expectedAmount <= 0) {
    return "exempt";
  }
  if (pastUnpaidMonths >= 2) return "behind2plus";
  if (pastUnpaidMonths === 1) return "behind1";
  if (!options.currentMonthPaid) return "due";
  return "current";
}

export function standingSortRank(standing: PaymentStanding): number {
  switch (standing) {
    case "behind2plus":
      return 0;
    case "behind1":
      return 1;
    case "due":
      return 2;
    case "current":
      return 3;
    case "exempt":
      return 4;
  }
}
