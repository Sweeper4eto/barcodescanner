/** Start of UTC calendar day for consistent expiry matching and storage. */
export function normalizeExpiryDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/** Inclusive start and exclusive end for matching entries on the same expiry day. */
export function expiryDateDayBounds(date: Date): { start: Date; end: Date } {
  const start = normalizeExpiryDate(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export const activeInventoryWhere = {
  removedAt: null,
  deletedAt: null,
} as const;
