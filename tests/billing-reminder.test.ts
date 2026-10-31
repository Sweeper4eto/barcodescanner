import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  BILLING_REMINDER_SNOOZE_MS,
  isBillingReminderForceDay,
  isBillingReminderSnoozed,
  shouldShowBillingReminder,
  snoozeBillingReminder,
} from "../src/lib/billing-reminder";

const SNOOZE_KEY = "expire365-billing-reminder-snooze";

const memory = new Map<string, string>();

function installStorageMock() {
  const storage = {
    getItem(key: string) {
      return memory.has(key) ? memory.get(key)! : null;
    },
    setItem(key: string, value: string) {
      memory.set(key, String(value));
    },
    removeItem(key: string) {
      memory.delete(key);
    },
    clear() {
      memory.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
}

afterEach(() => {
  memory.clear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe("billing reminder snooze", () => {
  test("Not now hides the reminder for one week for that month", () => {
    installStorageMock();
    const t0 = 1_700_000_000_000;
    snoozeBillingReminder(2026, 10, t0);

    assert.equal(isBillingReminderSnoozed(2026, 10, t0 + 1000), true);
    assert.equal(
      isBillingReminderSnoozed(2026, 10, t0 + BILLING_REMINDER_SNOOZE_MS - 1),
      true,
    );
    assert.equal(
      isBillingReminderSnoozed(2026, 10, t0 + BILLING_REMINDER_SNOOZE_MS),
      false,
    );
  });

  test("snooze from a prior month does not hide the new month", () => {
    installStorageMock();
    const t0 = 1_700_000_000_000;
    snoozeBillingReminder(2026, 10, t0);
    assert.equal(isBillingReminderSnoozed(2026, 11, t0 + 1000), false);
    assert.equal(isBillingReminderSnoozed(2026, 10, t0 + 1000), true);
  });

  test("without snooze the reminder is not blocked", () => {
    installStorageMock();
    assert.equal(isBillingReminderSnoozed(2026, 10), false);
  });

  test("expired snooze clears storage", () => {
    installStorageMock();
    const t0 = 1_700_000_000_000;
    snoozeBillingReminder(2026, 10, t0);
    assert.equal(memory.has(SNOOZE_KEY), true);
    assert.equal(
      isBillingReminderSnoozed(2026, 10, t0 + BILLING_REMINDER_SNOOZE_MS),
      false,
    );
    assert.equal(memory.has(SNOOZE_KEY), false);
  });

  test("force days are the 1st, 15th, and 22nd in Sofia", () => {
    assert.equal(
      isBillingReminderForceDay(new Date("2026-11-01T10:00:00.000Z")),
      true,
    );
    assert.equal(
      isBillingReminderForceDay(new Date("2026-10-15T09:00:00.000Z")),
      true,
    );
    assert.equal(
      isBillingReminderForceDay(new Date("2026-10-22T09:00:00.000Z")),
      true,
    );
    assert.equal(
      isBillingReminderForceDay(new Date("2026-10-10T09:00:00.000Z")),
      false,
    );
  });

  test("force days re-show after a snooze from an earlier day", () => {
    installStorageMock();
    const dayBefore = Date.parse("2026-10-14T10:00:00.000Z");
    const forceDay = Date.parse("2026-10-15T09:00:00.000Z");
    snoozeBillingReminder(2026, 10, dayBefore);
    assert.equal(isBillingReminderSnoozed(2026, 10, forceDay), true);
    assert.equal(shouldShowBillingReminder(2026, 10, forceDay), true);
  });

  test("Not now on a force day still hides for the rest of that day", () => {
    installStorageMock();
    const forceDay = Date.parse("2026-11-01T10:00:00.000Z");
    snoozeBillingReminder(2026, 11, forceDay);
    assert.equal(
      shouldShowBillingReminder(2026, 11, forceDay + 60_000),
      false,
    );
  });

  test("non-force days still respect snooze", () => {
    installStorageMock();
    const midMonth = Date.parse("2026-10-10T09:00:00.000Z");
    snoozeBillingReminder(2026, 10, midMonth - 60_000);
    assert.equal(shouldShowBillingReminder(2026, 10, midMonth), false);
  });
});
