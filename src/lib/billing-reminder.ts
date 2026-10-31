import { BILLING_TIME_ZONE } from "@/lib/payment-status";

/** Soft dismiss: hide the owner billing reminder for this long, then offer again if still unpaid. */
export const BILLING_REMINDER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Calendar days when a prior snooze is cleared so the reminder can show again. */
export const BILLING_REMINDER_FORCE_DAYS = [1, 15, 22] as const;

const SNOOZE_KEY = "expire365-billing-reminder-snooze";

type SnoozeRecord = {
  until: number;
  /** When the user tapped Not now (ms). */
  snoozedAt: number;
  year: number;
  month: number;
};

function readSnooze(): SnoozeRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SnoozeRecord>;
    if (
      typeof parsed.until !== "number" ||
      typeof parsed.year !== "number" ||
      typeof parsed.month !== "number"
    ) {
      return null;
    }
    return {
      until: parsed.until,
      snoozedAt:
        typeof parsed.snoozedAt === "number" ? parsed.snoozedAt : parsed.until - BILLING_REMINDER_SNOOZE_MS,
      year: parsed.year,
      month: parsed.month,
    };
  } catch {
    return null;
  }
}

function sofiaDateKey(now: Date | number): string {
  const date = typeof now === "number" ? new Date(now) : now;
  return date.toLocaleDateString("en-CA", { timeZone: BILLING_TIME_ZONE });
}

function sofiaDayOfMonth(now: Date | number): number {
  const date = typeof now === "number" ? new Date(now) : now;
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BILLING_TIME_ZONE,
      day: "numeric",
    }).format(date),
  );
}

/** True on the 1st, 15th, or 22nd in Europe/Sofia. */
export function isBillingReminderForceDay(
  now: Date | number = Date.now(),
): boolean {
  const day = sofiaDayOfMonth(now);
  return (BILLING_REMINDER_FORCE_DAYS as readonly number[]).includes(day);
}

/** True when Not now is still active for this billing month. */
export function isBillingReminderSnoozed(
  year: number,
  month: number,
  now: number = Date.now(),
): boolean {
  const snooze = readSnooze();
  if (!snooze) return false;
  if (snooze.year !== year || snooze.month !== month) return false;
  if (now >= snooze.until) {
    try {
      window.localStorage.removeItem(SNOOZE_KEY);
    } catch {
      /* ignore */
    }
    return false;
  }
  return true;
}

/**
 * Whether Home should offer the soft billing reminder.
 * Force days (1 / 15 / 22) re-prompt after a snooze from an earlier day, but
 * "Not now" on that same day still sticks (including across logout/login).
 */
export function shouldShowBillingReminder(
  year: number,
  month: number,
  now: number = Date.now(),
): boolean {
  if (!isBillingReminderSnoozed(year, month, now)) return true;

  if (!isBillingReminderForceDay(now)) return false;

  const snooze = readSnooze();
  if (!snooze) return true;
  // Snoozed earlier on this same Sofia calendar day → keep hidden.
  if (sofiaDateKey(snooze.snoozedAt) === sofiaDateKey(now)) return false;
  // Snoozed on a previous day → force day brings the reminder back.
  return true;
}

export function snoozeBillingReminder(
  year: number,
  month: number,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const record: SnoozeRecord = {
    until: now + BILLING_REMINDER_SNOOZE_MS,
    snoozedAt: now,
    year,
    month,
  };
  try {
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / private mode */
  }
}
