import test from "node:test";
import assert from "node:assert/strict";
import {
  isInQuietHours,
  isInSendWindow,
  mergeClientDefaults,
  parseTimeToMinutes,
  prefsFromUserRow,
  resolveNotifyStoreIds,
  shouldSendNotificationNow,
  splitItemsByTier,
  SYSTEM_DEFAULT_PREFS,
} from "../src/lib/expiry-notification-prefs";

const baseRow = {
  expiryNotifyEarlyEnabled: true,
  expiryNotifyEarlyDays: 14,
  expiryNotifyUrgentEnabled: true,
  expiryNotifyUrgentDays: 3,
  expiryNotifySchedule: "daily",
  expiryNotifyTime1: "09:00",
  expiryNotifyTime2: "18:00",
  expiryNotifyMinIntervalHours: 24,
  expiryQuietHoursEnabled: true,
  expiryQuietHoursStart: "22:00",
  expiryQuietHoursEnd: "07:00",
  expiryNotifyTimezone: "Europe/Sofia",
  expiryNotifyStoreIdsJson: null,
  expiryNotifyPrefsCustomized: false,
};

test("parseTimeToMinutes converts HH:mm", () => {
  assert.equal(parseTimeToMinutes("09:00"), 9 * 60);
  assert.equal(parseTimeToMinutes("22:30"), 22 * 60 + 30);
});

test("isInQuietHours handles overnight window", () => {
  assert.equal(isInQuietHours(23 * 60, "22:00", "07:00"), true);
  assert.equal(isInQuietHours(8 * 60, "22:00", "07:00"), false);
  assert.equal(isInQuietHours(3 * 60, "22:00", "07:00"), true);
});

test("splitItemsByTier prefers urgent over early", () => {
  const prefs = prefsFromUserRow(baseRow);
  const result = splitItemsByTier(
    [
      { daysUntilExpiry: 2 },
      { daysUntilExpiry: 10 },
    ],
    prefs,
  );
  assert.ok(result);
  assert.equal(result.tier, "urgent");
  assert.equal(result.items.length, 1);
});

test("splitItemsByTier returns early when no urgent items", () => {
  const prefs = prefsFromUserRow(baseRow);
  const result = splitItemsByTier([{ daysUntilExpiry: 10 }], prefs);
  assert.ok(result);
  assert.equal(result.tier, "early");
});

test("resolveNotifyStoreIds filters to assigned stores", () => {
  const prefs = { ...SYSTEM_DEFAULT_PREFS, storeIds: ["s1", "s9"] };
  assert.deepEqual(resolveNotifyStoreIds(prefs, ["s1", "s2"]), ["s1"]);
});

test("mergeClientDefaults applies client values for non-customized users", () => {
  const user = prefsFromUserRow(baseRow);
  const merged = mergeClientDefaults(user, {
    earlyDays: 21,
    urgentDays: 1,
    schedule: null,
    time1: "08:00",
    time2: null,
    minIntervalHours: null,
    quietEnabled: null,
    quietStart: null,
    quietEnd: null,
    timezone: null,
  });
  assert.equal(merged.earlyDays, 21);
  assert.equal(merged.urgentDays, 1);
  assert.equal(merged.time1, "08:00");
});

test("shouldSendNotificationNow blocks during quiet hours", () => {
  const prefs = prefsFromUserRow(baseRow);
  const quietTime = new Date("2026-06-02T21:00:00Z");
  assert.equal(shouldSendNotificationNow(prefs, null, quietTime), false);
});

test("isInSendWindow is true after scheduled time (catch-up)", () => {
  const prefs = prefsFromUserRow(baseRow);
  const nineAmSofia = new Date("2026-06-02T06:00:00Z");
  assert.equal(isInSendWindow(nineAmSofia, prefs), true);
  const afternoonSofia = new Date("2026-06-02T12:00:00Z");
  assert.equal(isInSendWindow(afternoonSofia, prefs), true);
});

test("isInSendWindow is false before first scheduled time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const beforeNineSofia = new Date("2026-06-02T05:30:00Z");
  assert.equal(isInSendWindow(beforeNineSofia, prefs), false);
});

test("shouldSendNotificationNow catch-up after 09:00 when cron runs later", () => {
  const prefs = prefsFromUserRow(baseRow);
  const afternoon = new Date("2026-06-02T12:00:00Z"); // 15:00 Sofia
  assert.equal(shouldSendNotificationNow(prefs, null, afternoon), true);
});

test("shouldSendNotificationNow skips second daily send same day", () => {
  const prefs = prefsFromUserRow(baseRow);
  const morningSend = new Date("2026-06-02T06:10:00Z"); // ~09:10 Sofia
  const afternoon = new Date("2026-06-02T12:00:00Z");
  assert.equal(shouldSendNotificationNow(prefs, morningSend, afternoon), false);
});

test("shouldSendNotificationNow allows second slot for twice_daily", () => {
  const prefs = prefsFromUserRow({
    ...baseRow,
    expiryNotifySchedule: "twice_daily",
  });
  const morningSend = new Date("2026-06-02T06:10:00Z");
  const evening = new Date("2026-06-02T15:30:00Z"); // 18:30 Sofia
  assert.equal(shouldSendNotificationNow(prefs, morningSend, evening), true);
});

test("shouldSendNotificationNow allows next day after prior send", () => {
  const prefs = prefsFromUserRow(baseRow);
  const yesterday = new Date("2026-06-01T06:10:00Z");
  const todayAfternoon = new Date("2026-06-02T12:00:00Z");
  assert.equal(shouldSendNotificationNow(prefs, yesterday, todayAfternoon), true);
});
