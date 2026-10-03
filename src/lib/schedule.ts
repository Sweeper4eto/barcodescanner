/** Store open window (minutes from midnight). MVP fixed hours. */
export const SCHEDULE_OPEN_MIN = 7 * 60;
export const SCHEDULE_CLOSE_MIN = 22 * 60;
export const SCHEDULE_SPAN_MIN = SCHEDULE_CLOSE_MIN - SCHEDULE_OPEN_MIN;
export const SCHEDULE_STEP_MIN = 15;

export const SCHEDULE_ACCESS_OPTIONS = ["disabled", "private", "public"] as const;
export type ScheduleAccess = (typeof SCHEDULE_ACCESS_OPTIONS)[number];

export function parseScheduleAccess(
  value: string | null | undefined,
): ScheduleAccess {
  if (value && (SCHEDULE_ACCESS_OPTIONS as readonly string[]).includes(value)) {
    return value as ScheduleAccess;
  }
  return "private";
}

export type ScheduleMode = "auto" | "manual";
export type ScheduleStatus = "DRAFT" | "FINALIZED";

export type PreferenceInput = {
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};

export type ShiftDraft = {
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};

/** Monday YYYY-MM-DD for the week containing `date` (local calendar). */
export function mondayOfWeek(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return formatYmd(d);
}

export function addDaysYmd(weekStart: string, days: number): string {
  const d = parseYmd(weekStart);
  d.setDate(d.getDate() + days);
  return formatYmd(d);
}

export function parseYmd(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, day ?? 1);
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parseYmd(value);
  return formatYmd(d) === value && d.getDay() === 1;
}

export function clampScheduleMinutes(min: number): number {
  const stepped = Math.round(min / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  return Math.min(SCHEDULE_CLOSE_MIN, Math.max(SCHEDULE_OPEN_MIN, stepped));
}

export function formatMinutesAsClock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Local calendar YYYY-MM-DD for the first day of the month containing `date`. */
export function monthStartYmd(date = new Date()): string {
  return formatYmd(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Sum shift lengths (minutes) whose calendar day is in
 * `[fromYmd, toYmdExclusive)` (local dates as YYYY-MM-DD).
 */
export function sumShiftMinutesInRange(
  shifts: {
    weekStart: string;
    dayIndex: number;
    startMin: number;
    endMin: number;
  }[],
  fromYmd: string,
  toYmdExclusive: string,
): number {
  let total = 0;
  for (const shift of shifts) {
    const ymd = addDaysYmd(shift.weekStart, shift.dayIndex);
    if (ymd < fromYmd || ymd >= toYmdExclusive) continue;
    total += Math.max(0, shift.endMin - shift.startMin);
  }
  return total;
}

/** Human duration from total minutes, always hours + zero-padded minutes. */
export function formatDurationMinutes(
  totalMin: number,
  hoursUnit: string,
  minutesUnit: string,
): string {
  const safe = Math.max(0, Math.round(totalMin));
  const hours = Math.floor(safe / 60);
  const minutes = String(safe % 60).padStart(2, "0");
  return `${hours}${hoursUnit} ${minutes}${minutesUnit}`;
}

export function parseClockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function validateWindow(startMin: number, endMin: number): boolean {
  return (
    Number.isInteger(startMin) &&
    Number.isInteger(endMin) &&
    startMin >= SCHEDULE_OPEN_MIN &&
    endMin <= SCHEDULE_CLOSE_MIN &&
    endMin - startMin >= SCHEDULE_STEP_MIN
  );
}

/** Shifts must stay inside the open window. Overlaps optional (manual only). */
export function validateDayShifts(
  shifts: ShiftDraft[],
  options?: { allowOverlap?: boolean },
): {
  ok: boolean;
  reason?: "overlap" | "bounds" | "empty";
} {
  if (shifts.length === 0) return { ok: true };
  const sorted = [...shifts].sort((a, b) => a.startMin - b.startMin);
  for (const shift of sorted) {
    if (!validateWindow(shift.startMin, shift.endMin)) {
      return { ok: false, reason: "bounds" };
    }
  }
  if (!options?.allowOverlap) {
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.startMin < sorted[i - 1]!.endMin) {
        return { ok: false, reason: "overlap" };
      }
    }
  }
  return { ok: true };
}

type MinuteInterval = { startMin: number; endMin: number };

/** Equal contiguous blocks over [startMin, endMin), 15‑minute steps. */
function equalSplitBlocks(
  dayIndex: number,
  userIds: string[],
  startMin: number,
  endMin: number,
): ShiftDraft[] {
  if (userIds.length === 0 || endMin - startMin < SCHEDULE_STEP_MIN) return [];
  const span = endMin - startMin;
  const n = userIds.length;
  const base =
    Math.floor(span / n / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  let remainder = span - base * n;
  const extras = Array.from({ length: n }, () => 0);
  let i = 0;
  while (remainder >= SCHEDULE_STEP_MIN) {
    extras[i % n]! += SCHEDULE_STEP_MIN;
    remainder -= SCHEDULE_STEP_MIN;
    i += 1;
  }
  const shifts: ShiftDraft[] = [];
  let cursor = startMin;
  for (let idx = 0; idx < n; idx++) {
    const len = base + extras[idx]!;
    const blockEnd = Math.min(endMin, cursor + len);
    if (blockEnd - cursor >= SCHEDULE_STEP_MIN) {
      shifts.push({
        userId: userIds[idx]!,
        dayIndex,
        startMin: cursor,
        endMin: blockEnd,
      });
    }
    cursor = blockEnd;
  }
  return shifts;
}

/** Parts of `window` not covered by any `blocked` interval. */
function freePartsWithin(
  window: MinuteInterval,
  blocked: MinuteInterval[],
): MinuteInterval[] {
  let parts: MinuteInterval[] = [
    { startMin: window.startMin, endMin: window.endMin },
  ];
  const sorted = [...blocked].sort((a, b) => a.startMin - b.startMin);
  for (const b of sorted) {
    const next: MinuteInterval[] = [];
    for (const p of parts) {
      if (b.endMin <= p.startMin || b.startMin >= p.endMin) {
        next.push(p);
        continue;
      }
      if (b.startMin > p.startMin) {
        next.push({ startMin: p.startMin, endMin: Math.min(b.startMin, p.endMin) });
      }
      if (b.endMin < p.endMin) {
        next.push({ startMin: Math.max(b.endMin, p.startMin), endMin: p.endMin });
      }
    }
    parts = next.filter((p) => p.endMin - p.startMin >= SCHEDULE_STEP_MIN);
  }
  return parts;
}

/**
 * Place each filler into free gaps as one contiguous block (~equal minutes).
 * One shift per user (DB unique on week/user/day).
 */
function placeFillersInGaps(
  dayIndex: number,
  fillers: string[],
  gaps: MinuteInterval[],
): ShiftDraft[] {
  if (fillers.length === 0) return [];
  const free = gaps
    .map((g) => ({ ...g }))
    .filter((g) => g.endMin - g.startMin >= SCHEDULE_STEP_MIN)
    .sort((a, b) => a.startMin - b.startMin);
  if (free.length === 0) return [];

  const total = free.reduce((s, g) => s + (g.endMin - g.startMin), 0);
  const n = fillers.length;
  const base =
    Math.floor(total / n / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  let remainder = total - base * n;
  const targets = Array.from({ length: n }, () => base);
  let r = 0;
  while (remainder >= SCHEDULE_STEP_MIN) {
    targets[r % n]! += SCHEDULE_STEP_MIN;
    remainder -= SCHEDULE_STEP_MIN;
    r += 1;
  }

  const shifts: ShiftDraft[] = [];
  for (let fi = 0; fi < n; fi++) {
    const need = targets[fi]!;
    if (need < SCHEDULE_STEP_MIN) continue;
    // Prefer a gap that can fit the whole target; else the largest gap left.
    let bestIdx = -1;
    let bestScore = -1;
    for (let gi = 0; gi < free.length; gi++) {
      const room = free[gi]!.endMin - free[gi]!.startMin;
      if (room < SCHEDULE_STEP_MIN) continue;
      const score = room >= need ? 1_000_000 + room : room;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = gi;
      }
    }
    if (bestIdx < 0) break;
    const gap = free[bestIdx]!;
    const take =
      Math.floor(Math.min(need, gap.endMin - gap.startMin) / SCHEDULE_STEP_MIN) *
      SCHEDULE_STEP_MIN;
    if (take < SCHEDULE_STEP_MIN) break;
    shifts.push({
      userId: fillers[fi]!,
      dayIndex,
      startMin: gap.startMin,
      endMin: gap.startMin + take,
    });
    gap.startMin += take;
  }
  return shifts;
}

/** Extend neighboring shifts into leftover gaps so the day stays covered. */
function absorbGapsIntoShifts(shifts: ShiftDraft[]): ShiftDraft[] {
  if (shifts.length === 0) return shifts;
  const sorted = [...shifts].sort((a, b) => a.startMin - b.startMin);
  if (sorted[0]!.startMin > SCHEDULE_OPEN_MIN) {
    sorted[0]!.startMin = SCHEDULE_OPEN_MIN;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const next = sorted[i + 1]!;
    if (cur.endMin < next.startMin) {
      const mid =
        Math.round((cur.endMin + next.startMin) / 2 / SCHEDULE_STEP_MIN) *
        SCHEDULE_STEP_MIN;
      cur.endMin = mid;
      next.startMin = mid;
    }
  }
  const last = sorted[sorted.length - 1]!;
  if (last.endMin < SCHEDULE_CLOSE_MIN) {
    last.endMin = SCHEDULE_CLOSE_MIN;
  }
  return sorted;
}

/**
 * Auto-fill one day covering 07:00–22:00.
 *
 * - No desires → equal contiguous split among everyone included.
 * - Desires → place each desire (fewest hours this month first). On overlap,
 *   earlier placer keeps the contested time; later keeps the longest free
 *   piece of their desire.
 * - Remaining gaps → one block each for people still without a shift.
 */
export function autoFillDay(args: {
  dayIndex: number;
  staffUserIds: string[];
  preferences: PreferenceInput[];
  /** Minutes already worked this month (1st → yesterday). Lower wins overlaps. */
  hoursThisMonthMin?: Record<string, number>;
}): ShiftDraft[] {
  const { dayIndex, staffUserIds, preferences } = args;
  if (staffUserIds.length === 0) return [];

  const hours = args.hoursThisMonthMin ?? {};
  const hourOf = (id: string) => hours[id] ?? 0;

  const prefsByUser = new Map(
    preferences
      .filter((p) => p.dayIndex === dayIndex && staffUserIds.includes(p.userId))
      .map((p) => [p.userId, p] as const),
  );

  const withDesire = staffUserIds.filter((id) => prefsByUser.has(id));
  if (withDesire.length === 0) {
    const ordered = [...staffUserIds].sort((a, b) => {
      const d = hourOf(a) - hourOf(b);
      return d !== 0 ? d : a.localeCompare(b);
    });
    return equalSplitBlocks(
      dayIndex,
      ordered,
      SCHEDULE_OPEN_MIN,
      SCHEDULE_CLOSE_MIN,
    );
  }

  // Fewest month-hours first → they claim overlapping desire time.
  const desireOrder = [...withDesire].sort((a, b) => {
    const d = hourOf(a) - hourOf(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const placed: ShiftDraft[] = [];
  for (const userId of desireOrder) {
    const pref = prefsByUser.get(userId)!;
    const free = freePartsWithin(
      { startMin: pref.startMin, endMin: pref.endMin },
      placed.map((p) => ({ startMin: p.startMin, endMin: p.endMin })),
    );
    free.sort(
      (a, b) => b.endMin - b.startMin - (a.endMin - a.startMin),
    );
    const best = free[0];
    if (best && best.endMin - best.startMin >= SCHEDULE_STEP_MIN) {
      placed.push({
        userId,
        dayIndex,
        startMin: best.startMin,
        endMin: best.endMin,
      });
    }
  }

  const gaps = freePartsWithin(
    { startMin: SCHEDULE_OPEN_MIN, endMin: SCHEDULE_CLOSE_MIN },
    placed.map((p) => ({ startMin: p.startMin, endMin: p.endMin })),
  );
  const taken = new Set(placed.map((p) => p.userId));
  const fillers = staffUserIds
    .filter((id) => !taken.has(id))
    .sort((a, b) => {
      const d = hourOf(a) - hourOf(b);
      return d !== 0 ? d : a.localeCompare(b);
    });

  placed.push(...placeFillersInGaps(dayIndex, fillers, gaps));
  return absorbGapsIntoShifts(placed);
}

export function autoFillWeek(args: {
  staffUserIds: string[];
  preferences: PreferenceInput[];
  hoursThisMonthMin?: Record<string, number>;
}): ShiftDraft[] {
  const out: ShiftDraft[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    out.push(
      ...autoFillDay({
        dayIndex,
        staffUserIds: args.staffUserIds,
        preferences: args.preferences,
        hoursThisMonthMin: args.hoursThisMonthMin,
      }),
    );
  }
  return out;
}
