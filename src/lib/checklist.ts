/**
 * Retail per-location checklists: due rules, favourites UX, 6-month retention.
 */

/** Kill-switch: hide hub/menu + block page/API until the feature is ready. */
export const CHECKLISTS_FEATURE_ENABLED = false;

export const CHECKLIST_TIME_ZONE = "Europe/Sofia";
export const CHECKLIST_RETENTION_MONTHS = 6;

export const CHECKLIST_RECURRENCES = [
  "daily",
  "weekly",
  "monthly",
  "once",
] as const;

export type ChecklistRecurrence = (typeof CHECKLIST_RECURRENCES)[number];

export type ChecklistTaskLike = {
  recurrence: string;
  dueDate?: string | null;
  weekday?: number | null;
  monthDay?: number | null;
  active?: boolean;
};

/** Calendar YYYY-MM-DD in checklist timezone (default Europe/Sofia). */
export function checklistCalendarYmd(
  date: Date = new Date(),
  timeZone: string = CHECKLIST_TIME_ZONE,
): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** Monday = 0 … Sunday = 6 for the given calendar day in timezone. */
export function checklistWeekdayIndex(
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): number {
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon UTC avoids DST edge cases for weekday of Sofia calendar day.
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(probe);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekdayName] ?? 0;
}

export function checklistMonthDay(ymd: string): number {
  const day = Number(ymd.slice(8, 10));
  return Number.isFinite(day) ? day : 1;
}

/** Monday YYYY-MM-DD of the ISO-ish week containing `ymd` (Mon–Sun). */
export function checklistWeekStartYmd(
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): string {
  const weekday = checklistWeekdayIndex(ymd, timeZone); // Mon=0
  return addCalendarDaysYmd(ymd, -weekday);
}

export function checklistWeekEndYmd(
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): string {
  return addCalendarDaysYmd(checklistWeekStartYmd(ymd, timeZone), 6);
}

export function checklistMonthStartYmd(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function checklistMonthEndYmd(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Completion window for a recurrence on calendar day `ymd`.
 * Weekly = that Mon–Sun; monthly = that calendar month; else = the day itself.
 */
export function checklistPeriodBounds(
  recurrence: string,
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): { start: string; end: string } {
  if (recurrence === "weekly") {
    return {
      start: checklistWeekStartYmd(ymd, timeZone),
      end: checklistWeekEndYmd(ymd, timeZone),
    };
  }
  if (recurrence === "monthly") {
    return {
      start: checklistMonthStartYmd(ymd),
      end: checklistMonthEndYmd(ymd),
    };
  }
  return { start: ymd, end: ymd };
}

/** Earliest day we need when loading period completions for "today". */
export function checklistCompletionWindowStartYmd(
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): string {
  const weekStart = checklistWeekStartYmd(ymd, timeZone);
  const monthStart = checklistMonthStartYmd(ymd);
  return weekStart < monthStart ? weekStart : monthStart;
}

export function completionInChecklistPeriod(
  dueDate: string,
  recurrence: string,
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): boolean {
  const { start, end } = checklistPeriodBounds(recurrence, ymd, timeZone);
  return dueDate >= start && dueDate <= end;
}

export function isChecklistRecurrence(
  value: unknown,
): value is ChecklistRecurrence {
  return (
    typeof value === "string" &&
    (CHECKLIST_RECURRENCES as readonly string[]).includes(value)
  );
}

export function addCalendarMonthsYmd(ymd: string, deltaMonths: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const index = y * 12 + (m - 1) + deltaMonths;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function checklistRetentionCutoffYmd(
  now: Date = new Date(),
  timeZone: string = CHECKLIST_TIME_ZONE,
): string {
  return addCalendarMonthsYmd(
    checklistCalendarYmd(now, timeZone),
    -CHECKLIST_RETENTION_MONTHS,
  );
}

/**
 * Whether the task is due on this calendar day.
 * Weekly: any day Mon–Sun (complete once that week).
 * Monthly: any day of the month (complete once that month).
 */
export function isChecklistTaskDueOn(
  task: ChecklistTaskLike,
  ymd: string,
  _timeZone: string = CHECKLIST_TIME_ZONE,
): boolean {
  if (task.active === false) return false;
  const recurrence = task.recurrence;
  if (recurrence === "daily") return true;
  if (recurrence === "weekly") return true;
  if (recurrence === "monthly") return true;
  if (recurrence === "once") {
    return Boolean(task.dueDate && task.dueDate === ymd);
  }
  return false;
}

export function compareYmd(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Delete completions older than retention, plus once/inactive tasks past cutoff.
 * Active daily/weekly/monthly definitions are kept.
 */
export async function purgeChecklistRetention(
  db: {
    checklistCompletion: {
      deleteMany: (args: {
        where: { dueDate: { lt: string } };
      }) => Promise<{ count: number }>;
    };
    checklistTask: {
      deleteMany: (args: {
        where: {
          OR: Array<{
            active?: boolean;
            updatedAt?: { lt: Date };
            recurrence?: string;
            dueDate?: { not: null; lt: string } | null;
            createdAt?: { lt: Date };
          }>;
        };
      }) => Promise<{ count: number }>;
    };
  },
  now: Date = new Date(),
  timeZone: string = CHECKLIST_TIME_ZONE,
): Promise<{ completions: number; tasks: number }> {
  const cutoff = checklistRetentionCutoffYmd(now, timeZone);

  const completions = await db.checklistCompletion.deleteMany({
    where: { dueDate: { lt: cutoff } },
  });

  const tasks = await db.checklistTask.deleteMany({
    where: {
      OR: [
        { active: false, updatedAt: { lt: new Date(`${cutoff}T00:00:00.000Z`) } },
        {
          recurrence: "once",
          dueDate: { not: null, lt: cutoff },
        },
        {
          recurrence: "once",
          dueDate: null,
          createdAt: { lt: new Date(`${cutoff}T00:00:00.000Z`) },
        },
      ],
    },
  });

  return { completions: completions.count, tasks: tasks.count };
}

export type ChecklistFields = {
  recurrence: ChecklistRecurrence;
  dueDate: string | null;
  weekday: number | null;
  monthDay: number | null;
};

export type ChecklistFavouriteDto = {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  recurrence: ChecklistRecurrence;
  dueDate: string | null;
  weekday: number | null;
  monthDay: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistTaskDto = {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  comment: string | null;
  recurrence: ChecklistRecurrence;
  dueDate: string | null;
  weekday: number | null;
  monthDay: number | null;
  active: boolean;
  /** True when a favourite catalog entry exists for this store + title. */
  inFavourites: boolean;
  createdAt: string;
  updatedAt: string;
  dueToday: boolean;
  completedToday: boolean;
  completedTodayAt: string | null;
  completedTodayBy: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
};

export function normalizeChecklistFields(data: {
  recurrence: ChecklistRecurrence;
  dueDate?: string | null;
  weekday?: number | null;
  monthDay?: number | null;
}): ChecklistFields | { error: "dueDate" | "weekday" | "monthDay" } {
  const recurrence = data.recurrence;
  if (recurrence === "once") {
    if (!data.dueDate) return { error: "dueDate" };
    return {
      recurrence,
      dueDate: data.dueDate,
      weekday: null,
      monthDay: null,
    };
  }
  // Weekly / monthly: no fixed weekday or month-day — due any day in the period.
  return {
    recurrence,
    dueDate: null,
    weekday: null,
    monthDay: null,
  };
}

export function toChecklistFavouriteDto(input: {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  recurrence: string;
  dueDate: string | null;
  weekday: number | null;
  monthDay: number | null;
  createdAt: Date;
  updatedAt: Date;
}): ChecklistFavouriteDto {
  return {
    id: input.id,
    storeId: input.storeId,
    title: input.title,
    note: input.note,
    recurrence: isChecklistRecurrence(input.recurrence)
      ? input.recurrence
      : "once",
    dueDate: input.dueDate,
    weekday: input.weekday,
    monthDay: input.monthDay,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
  };
}

export type ChecklistCompletionLike = {
  dueDate: string;
  completedAt: Date;
  completedByUser?: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
};

/** Newest completion that falls in the task's current period for `ymd`. */
export function pickChecklistPeriodCompletion<T extends ChecklistCompletionLike>(
  completions: T[],
  recurrence: string,
  ymd: string,
  timeZone: string = CHECKLIST_TIME_ZONE,
): T | null {
  const inPeriod = completions.filter((row) =>
    completionInChecklistPeriod(row.dueDate, recurrence, ymd, timeZone),
  );
  if (inPeriod.length === 0) return null;
  inPeriod.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  return inPeriod[0] ?? null;
}

export function toChecklistTaskDto(input: {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  comment?: string | null;
  recurrence: string;
  dueDate: string | null;
  weekday: number | null;
  monthDay: number | null;
  active: boolean;
  inFavourites?: boolean;
  createdAt: Date;
  updatedAt: Date;
  todayYmd: string;
  todayCompletion?: {
    completedAt: Date;
    completedByUser: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
  } | null;
  timeZone?: string;
}): ChecklistTaskDto {
  const recurrence = isChecklistRecurrence(input.recurrence)
    ? input.recurrence
    : "once";
  const dueToday = isChecklistTaskDueOn(
    {
      recurrence,
      dueDate: input.dueDate,
      weekday: input.weekday,
      monthDay: input.monthDay,
      active: input.active,
    },
    input.todayYmd,
    input.timeZone,
  );
  // For weekly/monthly, "completedToday" means completed in the current period.
  const completedToday = Boolean(input.todayCompletion);
  return {
    id: input.id,
    storeId: input.storeId,
    title: input.title,
    note: input.note,
    comment: input.comment ?? null,
    recurrence,
    dueDate: input.dueDate,
    weekday: input.weekday,
    monthDay: input.monthDay,
    active: input.active,
    inFavourites: Boolean(input.inFavourites),
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    dueToday,
    completedToday,
    completedTodayAt: input.todayCompletion?.completedAt.toISOString() ?? null,
    completedTodayBy: input.todayCompletion?.completedByUser
      ? {
          id: input.todayCompletion.completedByUser.id,
          username: input.todayCompletion.completedByUser.username,
          displayName: input.todayCompletion.completedByUser.displayName,
        }
      : null,
  };
}
