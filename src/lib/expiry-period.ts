import {
  DEFAULT_EXPIRY_PERIOD,
  EXPIRY_PERIOD_OPTIONS,
  type ExpiryPeriod,
  expiryPeriodDays,
  expiryPeriodToApiParam,
  parseExpiryPeriod,
} from "@/lib/expiry";

const STORAGE_KEY = "expire365:expiry-period";
const LEGACY_STORAGE_KEY = "magazin:expiry-period";

export function getStoredExpiryPeriod(): ExpiryPeriod {
  if (typeof window === "undefined") return DEFAULT_EXPIRY_PERIOD;
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return parseExpiryPeriod(current);
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return parseExpiryPeriod(legacy);
}

export function setStoredExpiryPeriod(period: ExpiryPeriod) {
  localStorage.setItem(STORAGE_KEY, period);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export { DEFAULT_EXPIRY_PERIOD, EXPIRY_PERIOD_OPTIONS, expiryPeriodDays, expiryPeriodToApiParam };
export type { ExpiryPeriod };
