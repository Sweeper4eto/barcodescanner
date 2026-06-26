export const EXPIRY_LIST_MAX_FUTURE_DAYS = 28;
export const EXPIRY_LIST_MAX_PAST_DAYS = 183;

export function expiryListDateBounds(now = new Date()) {
  const maxFuture = new Date(
    now.getTime() + EXPIRY_LIST_MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000,
  );
  const maxPast = new Date(
    now.getTime() - EXPIRY_LIST_MAX_PAST_DAYS * 24 * 60 * 60 * 1000,
  );
  return { maxFuture, maxPast };
}

export function expiryListVisible(expiryDate: Date, now = new Date()): boolean {
  const { maxFuture, maxPast } = expiryListDateBounds(now);
  const time = expiryDate.getTime();
  return time <= maxFuture.getTime() && time >= maxPast.getTime();
}

export function expiryUrgencyClass(expiryDate: Date, now = new Date()): string {
  const days = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 7) return "urgency-critical";
  if (days <= 14) return "urgency-warning";
  if (days <= 28) return "urgency-soon";
  return "urgency-normal";
}

export function paymentAmount(
  activeStoreCount: number,
  feePerStore: number,
  discount: number,
): number {
  return Math.max(0, activeStoreCount * feePerStore - discount);
}
