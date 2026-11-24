/**
 * Retail per-location temperature journals (°C дневник).
 * Always-daily points, no recurrence periods or assignees.
 */

import {
  CHECKLIST_RETENTION_MONTHS,
  CHECKLIST_TIME_ZONE,
  addCalendarDaysYmd,
  checklistCalendarYmd,
  checklistRetentionCutoffYmd,
} from "@/lib/checklist";

/** Kill-switch: hide hub/menu + block page/API until ready. */
export const TEMPERATURE_FEATURE_ENABLED = true;

export const TEMPERATURE_TIME_ZONE = CHECKLIST_TIME_ZONE;
export const TEMPERATURE_RETENTION_MONTHS = CHECKLIST_RETENTION_MONTHS;

export type TemperatureRangeStatus = "ok" | "high" | "low" | "unchecked";

export type TemperaturePersonDto = {
  id: string;
  username: string;
  displayName: string | null;
};

export type TemperaturePointDto = {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  minCelsius: number | null;
  maxCelsius: number | null;
  comment: string | null;
  commentImagePath: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** True when a reading exists for the requested log date. */
  completed: boolean;
  completedAt: string | null;
  completedBy: TemperaturePersonDto | null;
  celsius: number | null;
  rangeStatus: TemperatureRangeStatus;
};

export function temperatureCalendarYmd(
  date: Date = new Date(),
  timeZone: string = TEMPERATURE_TIME_ZONE,
): string {
  return checklistCalendarYmd(date, timeZone);
}

/** Readings older than this YMD are purged (same 6-month window as checklists). */
export function temperatureRetentionCutoffYmd(
  now: Date = new Date(),
  timeZone: string = TEMPERATURE_TIME_ZONE,
): string {
  return checklistRetentionCutoffYmd(now, timeZone);
}

export function isValidTemperatureYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function temperatureRangeStatus(input: {
  celsius: number | null | undefined;
  minCelsius: number | null | undefined;
  maxCelsius: number | null | undefined;
  completed: boolean;
}): TemperatureRangeStatus {
  if (!input.completed) return "unchecked";
  if (input.celsius == null || !Number.isFinite(input.celsius)) return "ok";
  if (
    input.minCelsius != null &&
    Number.isFinite(input.minCelsius) &&
    input.celsius < input.minCelsius
  ) {
    return "low";
  }
  if (
    input.maxCelsius != null &&
    Number.isFinite(input.maxCelsius) &&
    input.celsius > input.maxCelsius
  ) {
    return "high";
  }
  return "ok";
}

export function normalizeTemperatureRange(input: {
  minCelsius?: number | null;
  maxCelsius?: number | null;
}):
  | { minCelsius: number | null; maxCelsius: number | null }
  | { error: "range" } {
  const min =
    input.minCelsius == null || Number.isNaN(input.minCelsius)
      ? null
      : input.minCelsius;
  const max =
    input.maxCelsius == null || Number.isNaN(input.maxCelsius)
      ? null
      : input.maxCelsius;
  if (min != null && (min < -80 || min > 80)) return { error: "range" };
  if (max != null && (max < -80 || max > 80)) return { error: "range" };
  if (min != null && max != null && min > max) return { error: "range" };
  return { minCelsius: min, maxCelsius: max };
}

export function normalizeReadingCelsius(
  value: number | null | undefined,
): number | null | { error: "celsius" } {
  if (value == null || Number.isNaN(value)) return null;
  if (!Number.isFinite(value) || value < -80 || value > 80) {
    return { error: "celsius" };
  }
  return Math.round(value * 10) / 10;
}

export function toTemperaturePointDto(input: {
  id: string;
  storeId: string;
  title: string;
  note: string | null;
  minCelsius: number | null;
  maxCelsius: number | null;
  comment: string | null;
  commentImagePath: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  dayReading?: {
    celsius: number | null;
    completedAt: Date;
    completedByUser?: TemperaturePersonDto | null;
  } | null;
}): TemperaturePointDto {
  const completed = Boolean(input.dayReading);
  const celsius = input.dayReading?.celsius ?? null;
  return {
    id: input.id,
    storeId: input.storeId,
    title: input.title,
    note: input.note,
    minCelsius: input.minCelsius,
    maxCelsius: input.maxCelsius,
    comment: input.comment,
    commentImagePath: input.commentImagePath,
    active: input.active,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString(),
    completed,
    completedAt: input.dayReading?.completedAt.toISOString() ?? null,
    completedBy: input.dayReading?.completedByUser ?? null,
    celsius,
    rangeStatus: temperatureRangeStatus({
      celsius,
      minCelsius: input.minCelsius,
      maxCelsius: input.maxCelsius,
      completed,
    }),
  };
}

type DbLike = {
  temperatureReading: {
    deleteMany: (args: {
      where: { logDate: { lt: string } };
    }) => Promise<unknown>;
  };
};

/** Drop readings older than retention (same 6-month window as checklists). */
export async function purgeTemperatureRetention(db: DbLike): Promise<void> {
  const cutoff = temperatureRetentionCutoffYmd();
  await db.temperatureReading.deleteMany({
    where: { logDate: { lt: cutoff } },
  });
}

export { addCalendarDaysYmd };
