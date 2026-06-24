export function expiryListVisible(expiryDate: Date, now = new Date()): boolean {
  const threeMonthsMs = 1000 * 60 * 60 * 24 * 91;
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 183;
  const diff = expiryDate.getTime() - now.getTime();
  if (diff > threeMonthsMs) return false;
  if (diff < -sixMonthsMs) return false;
  return true;
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
