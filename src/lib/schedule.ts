/** Store open window (minutes from midnight). MVP fixed hours. */
export const SCHEDULE_OPEN_MIN = 7 * 60;
export const SCHEDULE_CLOSE_MIN = 22 * 60;
export const SCHEDULE_SPAN_MIN = SCHEDULE_CLOSE_MIN - SCHEDULE_OPEN_MIN;
export const SCHEDULE_STEP_MIN = 30;

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

/** Shifts must not overlap and must stay inside the open window. */
export function validateDayShifts(shifts: ShiftDraft[]): {
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
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startMin < sorted[i - 1]!.endMin) {
      return { ok: false, reason: "overlap" };
    }
  }
  return { ok: true };
}

/**
 * Auto-fill one day: contiguous non-overlapping blocks covering 07:00–22:00,
 * hours as even as possible, ordered by preference midpoints when present.
 */
export function autoFillDay(args: {
  dayIndex: number;
  staffUserIds: string[];
  preferences: PreferenceInput[];
}): ShiftDraft[] {
  const { dayIndex, staffUserIds, preferences } = args;
  if (staffUserIds.length === 0) return [];

  const prefsByUser = new Map(
    preferences
      .filter((p) => p.dayIndex === dayIndex && staffUserIds.includes(p.userId))
      .map((p) => [p.userId, p] as const),
  );

  // Prefer people who submitted a desire; otherwise use all staff.
  const withPref = staffUserIds.filter((id) => prefsByUser.has(id));
  const pool = withPref.length > 0 ? withPref : staffUserIds;

  const ordered = [...pool].sort((a, b) => {
    const pa = prefsByUser.get(a);
    const pb = prefsByUser.get(b);
    const midA = pa ? (pa.startMin + pa.endMin) / 2 : SCHEDULE_OPEN_MIN + SCHEDULE_SPAN_MIN / 2;
    const midB = pb ? (pb.startMin + pb.endMin) / 2 : SCHEDULE_OPEN_MIN + SCHEDULE_SPAN_MIN / 2;
    return midA - midB;
  });

  const n = ordered.length;
  const base = Math.floor(SCHEDULE_SPAN_MIN / n / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN;
  let remainder =
    SCHEDULE_SPAN_MIN - base * n;
  // Distribute leftover in 30-min chunks.
  const extras = Array.from({ length: n }, () => 0);
  let i = 0;
  while (remainder >= SCHEDULE_STEP_MIN) {
    extras[i % n]! += SCHEDULE_STEP_MIN;
    remainder -= SCHEDULE_STEP_MIN;
    i += 1;
  }

  const shifts: ShiftDraft[] = [];
  let cursor = SCHEDULE_OPEN_MIN;
  for (let idx = 0; idx < n; idx++) {
    const len = base + extras[idx]!;
    const startMin = cursor;
    const endMin = Math.min(SCHEDULE_CLOSE_MIN, cursor + len);
    if (endMin - startMin >= SCHEDULE_STEP_MIN) {
      shifts.push({
        userId: ordered[idx]!,
        dayIndex,
        startMin,
        endMin,
      });
    }
    cursor = endMin;
  }
  return shifts;
}

export function autoFillWeek(args: {
  staffUserIds: string[];
  preferences: PreferenceInput[];
}): ShiftDraft[] {
  const out: ShiftDraft[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    out.push(
      ...autoFillDay({
        dayIndex,
        staffUserIds: args.staffUserIds,
        preferences: args.preferences,
      }),
    );
  }
  return out;
}
