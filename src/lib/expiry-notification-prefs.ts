import { z } from "zod";

export type NotifySchedule = "daily" | "twice_daily" | "custom";

export type ExpiryNotificationPrefs = {
  earlyEnabled: boolean;
  earlyDays: number;
  urgentEnabled: boolean;
  urgentDays: number;
  schedule: NotifySchedule;
  time1: string;
  time2: string;
  minIntervalHours: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  storeIds: string[] | null;
  customized: boolean;
};

export type ClientExpiryDefaults = {
  earlyDays: number | null;
  urgentDays: number | null;
  schedule: NotifySchedule | null;
  time1: string | null;
  time2: string | null;
  minIntervalHours: number | null;
  quietEnabled: boolean | null;
  quietStart: string | null;
  quietEnd: string | null;
  timezone: string | null;
};

export const SYSTEM_DEFAULT_PREFS: ExpiryNotificationPrefs = {
  earlyEnabled: true,
  earlyDays: 14,
  urgentEnabled: true,
  urgentDays: 3,
  schedule: "daily",
  time1: "09:00",
  time2: "18:00",
  minIntervalHours: 24,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  timezone: "Europe/Sofia",
  storeIds: null,
  customized: false,
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const expiryNotificationPrefsSchema = z
  .object({
    earlyEnabled: z.boolean(),
    earlyDays: z.number().int().min(1).max(90),
    urgentEnabled: z.boolean(),
    urgentDays: z.number().int().min(0).max(90),
    schedule: z.enum(["daily", "twice_daily", "custom"]),
    time1: z.string().regex(timePattern),
    time2: z.string().regex(timePattern),
    minIntervalHours: z.number().int().min(6).max(168),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string().regex(timePattern),
    quietHoursEnd: z.string().regex(timePattern),
    timezone: z.string().min(1).max(64),
    storeIds: z.array(z.string().min(1)).nullable(),
  })
  .refine((value) => value.earlyEnabled || value.urgentEnabled, {
    message: "At least one alert tier must be enabled",
  })
  .refine(
    (value) =>
      !value.earlyEnabled ||
      !value.urgentEnabled ||
      value.earlyDays >= value.urgentDays,
    { message: "Early warning days must be >= urgent days" },
  );

export type UserPrefsRow = {
  expiryNotifyEarlyEnabled: boolean;
  expiryNotifyEarlyDays: number;
  expiryNotifyUrgentEnabled: boolean;
  expiryNotifyUrgentDays: number;
  expiryNotifySchedule: string;
  expiryNotifyTime1: string;
  expiryNotifyTime2: string;
  expiryNotifyMinIntervalHours: number;
  expiryQuietHoursEnabled: boolean;
  expiryQuietHoursStart: string;
  expiryQuietHoursEnd: string;
  expiryNotifyTimezone: string;
  expiryNotifyStoreIdsJson: string | null;
  expiryNotifyPrefsCustomized: boolean;
};

export type ClientDefaultsRow = {
  expiryDefaultEarlyDays: number | null;
  expiryDefaultUrgentDays: number | null;
  expiryDefaultSchedule: string | null;
  expiryDefaultTime1: string | null;
  expiryDefaultTime2: string | null;
  expiryDefaultMinIntervalHours: number | null;
  expiryDefaultQuietEnabled: boolean | null;
  expiryDefaultQuietStart: string | null;
  expiryDefaultQuietEnd: string | null;
  expiryDefaultTimezone: string | null;
};

function parseSchedule(value: string): NotifySchedule {
  if (value === "twice_daily" || value === "custom") return value;
  return "daily";
}

export function clientDefaultsFromRow(
  row: ClientDefaultsRow | null | undefined,
): ClientExpiryDefaults | null {
  if (!row) return null;
  const hasAny =
    row.expiryDefaultEarlyDays != null ||
    row.expiryDefaultUrgentDays != null ||
    row.expiryDefaultSchedule != null ||
    row.expiryDefaultTime1 != null;
  if (!hasAny) return null;

  return {
    earlyDays: row.expiryDefaultEarlyDays,
    urgentDays: row.expiryDefaultUrgentDays,
    schedule: row.expiryDefaultSchedule
      ? parseSchedule(row.expiryDefaultSchedule)
      : null,
    time1: row.expiryDefaultTime1,
    time2: row.expiryDefaultTime2,
    minIntervalHours: row.expiryDefaultMinIntervalHours,
    quietEnabled: row.expiryDefaultQuietEnabled,
    quietStart: row.expiryDefaultQuietStart,
    quietEnd: row.expiryDefaultQuietEnd,
    timezone: row.expiryDefaultTimezone,
  };
}

export function prefsFromUserRow(row: UserPrefsRow): ExpiryNotificationPrefs {
  let storeIds: string[] | null = null;
  if (row.expiryNotifyStoreIdsJson) {
    try {
      const parsed = JSON.parse(row.expiryNotifyStoreIdsJson) as unknown;
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
        storeIds = parsed.length > 0 ? parsed : null;
      }
    } catch {
      storeIds = null;
    }
  }

  return {
    earlyEnabled: row.expiryNotifyEarlyEnabled,
    earlyDays: row.expiryNotifyEarlyDays,
    urgentEnabled: row.expiryNotifyUrgentEnabled,
    urgentDays: row.expiryNotifyUrgentDays,
    schedule: parseSchedule(row.expiryNotifySchedule),
    time1: row.expiryNotifyTime1,
    time2: row.expiryNotifyTime2,
    minIntervalHours: row.expiryNotifyMinIntervalHours,
    quietHoursEnabled: row.expiryQuietHoursEnabled,
    quietHoursStart: row.expiryQuietHoursStart,
    quietHoursEnd: row.expiryQuietHoursEnd,
    timezone: row.expiryNotifyTimezone,
    storeIds,
    customized: row.expiryNotifyPrefsCustomized,
  };
}

export function mergeClientDefaults(
  prefs: ExpiryNotificationPrefs,
  defaults: ClientExpiryDefaults | null,
): ExpiryNotificationPrefs {
  if (!defaults || prefs.customized) return prefs;

  return {
    ...prefs,
    earlyDays: defaults.earlyDays ?? prefs.earlyDays,
    urgentDays: defaults.urgentDays ?? prefs.urgentDays,
    schedule: defaults.schedule ?? prefs.schedule,
    time1: defaults.time1 ?? prefs.time1,
    time2: defaults.time2 ?? prefs.time2,
    minIntervalHours: defaults.minIntervalHours ?? prefs.minIntervalHours,
    quietHoursEnabled: defaults.quietEnabled ?? prefs.quietHoursEnabled,
    quietHoursStart: defaults.quietStart ?? prefs.quietHoursStart,
    quietHoursEnd: defaults.quietEnd ?? prefs.quietHoursEnd,
    timezone: defaults.timezone ?? prefs.timezone,
  };
}

export function prefsToUserData(prefs: ExpiryNotificationPrefs) {
  return {
    expiryNotifyEarlyEnabled: prefs.earlyEnabled,
    expiryNotifyEarlyDays: prefs.earlyDays,
    expiryNotifyUrgentEnabled: prefs.urgentEnabled,
    expiryNotifyUrgentDays: prefs.urgentDays,
    expiryNotifySchedule: prefs.schedule,
    expiryNotifyTime1: prefs.time1,
    expiryNotifyTime2: prefs.time2,
    expiryNotifyMinIntervalHours: prefs.minIntervalHours,
    expiryQuietHoursEnabled: prefs.quietHoursEnabled,
    expiryQuietHoursStart: prefs.quietHoursStart,
    expiryQuietHoursEnd: prefs.quietHoursEnd,
    expiryNotifyTimezone: prefs.timezone,
    expiryNotifyStoreIdsJson:
      prefs.storeIds && prefs.storeIds.length > 0
        ? JSON.stringify(prefs.storeIds)
        : null,
    expiryNotifyPrefsCustomized: true,
  };
}

export function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function getLocalTimeParts(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    // Some engines report midnight as 24 — normalize to 0.
    let hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    if (hour === 24) hour = 0;
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { hour, minute };
  } catch {
    return { hour: date.getUTCHours(), minute: date.getUTCMinutes() };
  }
}

function localDateKey(date: Date, timeZone: string): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function localMinutesOf(date: Date, timeZone: string): number {
  const { hour, minute } = getLocalTimeParts(date, timeZone);
  return hour * 60 + minute;
}

/** Scheduled send times for today, sorted ascending (minutes from midnight). */
export function scheduledSlotMinutes(
  prefs: Pick<ExpiryNotificationPrefs, "schedule" | "time1" | "time2">,
): number[] {
  if (prefs.schedule === "custom") return [];
  const slots =
    prefs.schedule === "twice_daily"
      ? [parseTimeToMinutes(prefs.time1), parseTimeToMinutes(prefs.time2)]
      : [parseTimeToMinutes(prefs.time1)];
  return [...new Set(slots)].sort((a, b) => a - b);
}

export function isInQuietHours(
  localMinutes: number,
  start: string,
  end: string,
): boolean {
  const startM = parseTimeToMinutes(start);
  const endM = parseTimeToMinutes(end);
  if (startM === endM) return false;
  if (startM < endM) {
    return localMinutes >= startM && localMinutes < endM;
  }
  return localMinutes >= startM || localMinutes < endM;
}

/**
 * True when at least one scheduled slot for today has already passed.
 * Custom schedule is always "open" (interval alone gates sending).
 *
 * Catch-up: any cron after the chosen time can send — not only the exact hour.
 * A strict 09:00–10:00 window broke digests when cron ran nightly or later.
 */
export function isInSendWindow(
  now: Date,
  prefs: Pick<
    ExpiryNotificationPrefs,
    "schedule" | "time1" | "time2" | "timezone"
  >,
): boolean {
  if (prefs.schedule === "custom") return true;
  const localMinutes = localMinutesOf(now, prefs.timezone);
  const slots = scheduledSlotMinutes(prefs);
  return slots.some((slot) => localMinutes >= slot);
}

/**
 * Latest scheduled slot that is already due today, or null if none yet.
 */
export function latestDueSlotMinutes(
  now: Date,
  prefs: Pick<
    ExpiryNotificationPrefs,
    "schedule" | "time1" | "time2" | "timezone"
  >,
): number | null {
  if (prefs.schedule === "custom") return null;
  const localMinutes = localMinutesOf(now, prefs.timezone);
  const due = scheduledSlotMinutes(prefs).filter((slot) => localMinutes >= slot);
  return due.length > 0 ? due[due.length - 1]! : null;
}

export function shouldSendNotificationNow(
  prefs: ExpiryNotificationPrefs,
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  const localMinutes = localMinutesOf(now, prefs.timezone);

  if (prefs.quietHoursEnabled) {
    if (
      isInQuietHours(
        localMinutes,
        prefs.quietHoursStart,
        prefs.quietHoursEnd,
      )
    ) {
      return false;
    }
  }

  if (prefs.schedule === "custom") {
    if (!lastSentAt) return true;
    const minMs = prefs.minIntervalHours * 60 * 60 * 1000;
    return now.getTime() - lastSentAt.getTime() >= minMs;
  }

  const dueSlot = latestDueSlotMinutes(now, prefs);
  if (dueSlot == null) return false;

  if (!lastSentAt) return true;

  const today = localDateKey(now, prefs.timezone);
  const lastDay = localDateKey(lastSentAt, prefs.timezone);
  if (lastDay !== today) return true;

  // Already sent for this slot (or a later one) today.
  const lastMinutes = localMinutesOf(lastSentAt, prefs.timezone);
  return lastMinutes < dueSlot;
}

export function resolveNotifyStoreIds(
  prefs: ExpiryNotificationPrefs,
  assignedStoreIds: string[],
): string[] {
  if (assignedStoreIds.length === 0) return [];
  if (!prefs.storeIds || prefs.storeIds.length === 0) {
    return assignedStoreIds;
  }
  const allowed = new Set(assignedStoreIds);
  return prefs.storeIds.filter((id) => allowed.has(id));
}

export type DigestTier = "urgent" | "early";

export function splitItemsByTier(
  items: Array<{ daysUntilExpiry: number }>,
  prefs: Pick<
    ExpiryNotificationPrefs,
    "earlyEnabled" | "earlyDays" | "urgentEnabled" | "urgentDays"
  >,
): { tier: DigestTier; withinDays: number; items: typeof items } | null {
  const urgentItems = prefs.urgentEnabled
    ? items.filter((item) => item.daysUntilExpiry <= prefs.urgentDays)
    : [];
  if (urgentItems.length > 0) {
    return { tier: "urgent", withinDays: prefs.urgentDays, items: urgentItems };
  }

  const earlyItems = prefs.earlyEnabled
    ? items.filter((item) => item.daysUntilExpiry <= prefs.earlyDays)
    : [];
  if (earlyItems.length > 0) {
    return { tier: "early", withinDays: prefs.earlyDays, items: earlyItems };
  }

  return null;
}

export function formatPrefsSummary(
  prefs: ExpiryNotificationPrefs,
  labels: {
    urgentDays: (days: number) => string;
    earlyDays: (days: number) => string;
    time: (time: string) => string;
    allStores: string;
    storeCount: (count: number) => string;
    off: string;
  },
): string {
  const parts: string[] = [];
  if (prefs.urgentEnabled) parts.push(labels.urgentDays(prefs.urgentDays));
  if (prefs.earlyEnabled) parts.push(labels.earlyDays(prefs.earlyDays));
  if (parts.length === 0) return labels.off;
  if (prefs.schedule === "daily") {
    parts.push(labels.time(prefs.time1));
  }
  if (prefs.storeIds && prefs.storeIds.length > 0) {
    parts.push(labels.storeCount(prefs.storeIds.length));
  } else {
    parts.push(labels.allStores);
  }
  return parts.join(" · ");
}

export const clientDefaultsSchema = z.object({
  earlyDays: z.number().int().min(1).max(90).nullable().optional(),
  urgentDays: z.number().int().min(0).max(90).nullable().optional(),
  schedule: z.enum(["daily", "twice_daily", "custom"]).nullable().optional(),
  time1: z.string().regex(timePattern).nullable().optional(),
  time2: z.string().regex(timePattern).nullable().optional(),
  minIntervalHours: z.number().int().min(6).max(168).nullable().optional(),
  quietEnabled: z.boolean().nullable().optional(),
  quietStart: z.string().regex(timePattern).nullable().optional(),
  quietEnd: z.string().regex(timePattern).nullable().optional(),
  timezone: z.string().min(1).max(64).nullable().optional(),
});

export function clientDefaultsToData(
  defaults: z.infer<typeof clientDefaultsSchema>,
) {
  return {
    expiryDefaultEarlyDays: defaults.earlyDays ?? null,
    expiryDefaultUrgentDays: defaults.urgentDays ?? null,
    expiryDefaultSchedule: defaults.schedule ?? null,
    expiryDefaultTime1: defaults.time1 ?? null,
    expiryDefaultTime2: defaults.time2 ?? null,
    expiryDefaultMinIntervalHours: defaults.minIntervalHours ?? null,
    expiryDefaultQuietEnabled: defaults.quietEnabled ?? null,
    expiryDefaultQuietStart: defaults.quietStart ?? null,
    expiryDefaultQuietEnd: defaults.quietEnd ?? null,
    expiryDefaultTimezone: defaults.timezone ?? null,
  };
}
