/** Pure helpers for owner analytics windows and spike detection. */

export function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addUtcDays(date: Date, days: number): Date {
  const d = startOfUtcDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function ymdUtc(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

/** Inclusive week window ending today (UTC): last 7 days. */
export function thisWeekWindow(now = new Date()): { start: Date; end: Date } {
  const end = addUtcDays(now, 1); // exclusive
  const start = addUtcDays(now, -6);
  return { start, end };
}

export function priorWeekWindow(now = new Date()): { start: Date; end: Date } {
  const thisWeek = thisWeekWindow(now);
  const end = thisWeek.start;
  const start = addUtcDays(end, -7);
  return { start, end };
}

export function thisMonthWindow(now = new Date()): { start: Date; end: Date } {
  const end = addUtcDays(now, 1);
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  return { start, end };
}

export function priorMonthWindow(now = new Date()): { start: Date; end: Date } {
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  return { start, end: thisMonthStart };
}

/** % change vs prior; null when prior is 0. */
export function trendPercent(
  current: number,
  prior: number,
): number | null {
  if (prior <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

/**
 * Spike when this week is at least 50% above prior week and at least `minQty`.
 */
export function isWasteSpike(
  thisWeekQty: number,
  priorWeekQty: number,
  minQty = 3,
): boolean {
  if (thisWeekQty < minQty) return false;
  if (priorWeekQty <= 0) return thisWeekQty >= minQty;
  return thisWeekQty >= priorWeekQty * 1.5;
}

export type StaffCount = {
  userId: string;
  username: string;
  count: number;
};

export function topStaff(
  rows: Array<{ userId: string | null; username: string }>,
  limit = 5,
): StaffCount[] {
  const map = new Map<string, StaffCount>();
  for (const row of rows) {
    const id = row.userId ?? `name:${row.username}`;
    const prev = map.get(id);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(id, {
        userId: row.userId ?? "",
        username: row.username,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
