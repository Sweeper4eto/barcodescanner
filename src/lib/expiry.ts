export const EXPIRY_LIST_MAX_PAST_DAYS = 183;

export const EXPIRY_PERIOD_DAYS = {
  "2w": 14,
  "1m": 30,
  "3m": 90,
} as const;

export const EXPIRY_PERIOD_OPTIONS = ["2w", "1m", "3m", "all"] as const;
export type ExpiryPeriod = (typeof EXPIRY_PERIOD_OPTIONS)[number];

export const DEFAULT_EXPIRY_PERIOD: ExpiryPeriod = "1m";

export const DEFAULT_EXPIRY_FUTURE_DAYS = EXPIRY_PERIOD_DAYS[DEFAULT_EXPIRY_PERIOD];

/** @deprecated Use DEFAULT_EXPIRY_FUTURE_DAYS */
export const EXPIRY_LIST_MAX_FUTURE_DAYS = DEFAULT_EXPIRY_FUTURE_DAYS;

export function parseExpiryPeriod(value: string | null | undefined): ExpiryPeriod {
  if (value === "6m") return "all";
  if (value && (EXPIRY_PERIOD_OPTIONS as readonly string[]).includes(value)) {
    return value as ExpiryPeriod;
  }
  return DEFAULT_EXPIRY_PERIOD;
}

export function expiryPeriodDays(period: Exclude<ExpiryPeriod, "all">): number {
  return EXPIRY_PERIOD_DAYS[period];
}

export function expiryPeriodToApiParam(period: ExpiryPeriod): string {
  return period === "all" ? "all" : String(expiryPeriodDays(period));
}

export function parseExpiryWithinDays(value: string | null | undefined): number | "all" {
  if (value === "all") return "all";
  const parsed = Number.parseInt(value ?? "", 10);
  const allowed = Object.values(EXPIRY_PERIOD_DAYS);
  if (allowed.includes(parsed as (typeof allowed)[number])) {
    return parsed;
  }
  return expiryPeriodDays("1m");
}

export function expiryListMaxPast(now = new Date()) {
  return new Date(now.getTime() - EXPIRY_LIST_MAX_PAST_DAYS * 24 * 60 * 60 * 1000);
}

export function expiryListDateBounds(
  now = new Date(),
  futureDays: number | "all" = DEFAULT_EXPIRY_FUTURE_DAYS,
) {
  const maxPast = expiryListMaxPast(now);
  if (futureDays === "all") {
    return { maxFuture: null, maxPast };
  }
  const maxFuture = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000);
  return { maxFuture, maxPast };
}

export function expiryListVisible(
  expiryDate: Date,
  now = new Date(),
  futureDays: number | "all" = DEFAULT_EXPIRY_FUTURE_DAYS,
): boolean {
  const { maxFuture, maxPast } = expiryListDateBounds(now, futureDays);
  const time = expiryDate.getTime();
  if (time < maxPast.getTime()) return false;
  if (futureDays === "all" || maxFuture === null) return true;
  return time <= maxFuture.getTime();
}

export function expiryUrgencyClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) return "urgency-critical";
  if (days <= 14) return "urgency-warning";
  if (days <= 28) return "urgency-soon";
  return "urgency-normal";
}

export function expiryUrgencyStripeClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) return "bg-[var(--urgency-critical-border)]";
  if (days <= 14) return "bg-[var(--urgency-warning-border)]";
  if (days <= 28) return "bg-[var(--urgency-soon-border)]";
  return "bg-card-border";
}

export function expiryUrgencyBadgeClass(expiryDate: Date, now = new Date()): string {
  const days = daysUntilExpiry(expiryDate, now);
  if (days <= 7) {
    return "border-[var(--urgency-critical-border)] bg-[var(--urgency-critical-bg)] text-error";
  }
  if (days <= 14) {
    return "border-[var(--urgency-warning-border)] bg-[var(--urgency-warning-bg)] text-warning-fg";
  }
  if (days <= 28) {
    return "border-[var(--urgency-soon-border)] bg-[var(--urgency-soon-bg)] text-foreground";
  }
  return "border-card-border bg-subtle text-foreground";
}

export function daysUntilExpiry(expiryDate: Date, now = new Date()): number {
  return Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Locale calendar day with leading zeros (e.g. en: 04/15/2027, bg: 15.04.2027).
 * Order still follows the UI language locale.
 */
export function formatLocaleDay(
  input: Date | string,
  locale: string,
  options?: { utc?: boolean },
): string {
  let date: Date;
  if (typeof input === "string") {
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (ymd) {
      date = new Date(
        Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])),
      );
      return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    }
    date = new Date(input);
    if (Number.isNaN(date.getTime())) return input;
  } else {
    date = input;
  }

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(options?.utc ? { timeZone: "UTC" } : {}),
  });
}

export function paymentAmount(
  activeStoreCount: number,
  feePerStore: number,
  discount: number,
): number {
  return Math.max(0, activeStoreCount * feePerStore - discount);
}
