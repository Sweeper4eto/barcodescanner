export const EXPIRY_LIST_MAX_PAST_DAYS = 183;

export const EXPIRY_PERIOD_DAYS = {
  "2w": 14,
  "1m": 30,
  "3m": 90,
  "6m": 180,
} as const;

export const EXPIRY_PERIOD_OPTIONS = ["2w", "1m", "3m", "6m"] as const;
export type ExpiryPeriod = (typeof EXPIRY_PERIOD_OPTIONS)[number];

export const DEFAULT_EXPIRY_PERIOD: ExpiryPeriod = "1m";

/** @deprecated Use expiryPeriodDays(DEFAULT_EXPIRY_PERIOD) */
export const EXPIRY_LIST_MAX_FUTURE_DAYS = EXPIRY_PERIOD_DAYS[DEFAULT_EXPIRY_PERIOD];

export function parseExpiryPeriod(value: string | null | undefined): ExpiryPeriod {
  if (value && (EXPIRY_PERIOD_OPTIONS as readonly string[]).includes(value)) {
    return value as ExpiryPeriod;
  }
  return DEFAULT_EXPIRY_PERIOD;
}

export function expiryPeriodDays(period: ExpiryPeriod): number {
  return EXPIRY_PERIOD_DAYS[period];
}

export function parseExpiryWithinDays(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  const allowed = Object.values(EXPIRY_PERIOD_DAYS);
  if (allowed.includes(parsed as (typeof allowed)[number])) {
    return parsed;
  }
  return expiryPeriodDays(DEFAULT_EXPIRY_PERIOD);
}

export function expiryListDateBounds(
  now = new Date(),
  futureDays = expiryPeriodDays(DEFAULT_EXPIRY_PERIOD),
) {
  const maxFuture = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
  const maxPast = new Date(now.getTime() - EXPIRY_LIST_MAX_PAST_DAYS * 24 * 60 * 60 * 1000);
  return { maxFuture, maxPast };
}

export function expiryListVisible(
  expiryDate: Date,
  now = new Date(),
  futureDays = expiryPeriodDays(DEFAULT_EXPIRY_PERIOD),
): boolean {
  const { maxFuture, maxPast } = expiryListDateBounds(now, futureDays);
  const time = expiryDate.getTime();
  return time <= maxFuture.getTime() && time >= maxPast.getTime();
}

export function expiryUrgencyClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) return "urgency-critical";
  if (days <= 14) return "urgency-warning";
  if (days <= 28) return "urgency-soon";
  return "urgency-normal";
}

export function daysUntilExpiry(expiryDate: Date, now = new Date()): number {
  return Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function paymentAmount(
  activeStoreCount: number,
  feePerStore: number,
  discount: number,
): number {
  return Math.max(0, activeStoreCount * feePerStore - discount);
}
