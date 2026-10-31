/** Soft dismiss: hide the owner billing reminder for this long, then offer again if still unpaid. */
export const BILLING_REMINDER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const SNOOZE_KEY = "expire365-billing-reminder-snooze";

type SnoozeRecord = {
  until: number;
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
      year: parsed.year,
      month: parsed.month,
    };
  } catch {
    return null;
  }
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

export function snoozeBillingReminder(
  year: number,
  month: number,
  now: number = Date.now(),
): void {
  if (typeof window === "undefined") return;
  const record: SnoozeRecord = {
    until: now + BILLING_REMINDER_SNOOZE_MS,
    year,
    month,
  };
  try {
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / private mode */
  }
}
