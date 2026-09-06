export type BillingPeriod = { year: number; month: number };

export type PaymentStanding = "current" | "behind1" | "behind2plus" | "exempt";

export function periodKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function comparePeriods(a: BillingPeriod, b: BillingPeriod): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function addMonths(period: BillingPeriod, delta: number): BillingPeriod {
  const date = new Date(period.year, period.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function periodFromDate(date: Date): BillingPeriod {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
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
 * Count months since billing start (client created month) through now
 * that have no payment. One payment covers the whole client (all locations).
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

export function paymentStandingFromUnpaid(
  unpaidMonths: number,
  options: {
    homeUser: boolean;
    paymentsRequired: boolean;
    expectedAmount: number;
  },
): PaymentStanding {
  if (options.homeUser) return "exempt";
  // Payments off, or fee × locations ≤ 0 → always green.
  if (!options.paymentsRequired || options.expectedAmount <= 0) {
    return "current";
  }
  if (unpaidMonths <= 0) return "current";
  if (unpaidMonths === 1) return "behind1";
  return "behind2plus";
}

export function standingSortRank(standing: PaymentStanding): number {
  switch (standing) {
    case "behind2plus":
      return 0;
    case "behind1":
      return 1;
    case "current":
      return 2;
    case "exempt":
      return 3;
  }
}
