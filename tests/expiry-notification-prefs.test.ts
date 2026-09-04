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

test("isInSendWindow matches daily hour in timezone", () => {
  const prefs = prefsFromUserRow(baseRow);
  const nineAmSofia = new Date("2026-06-02T06:00:00Z");
  assert.equal(isInSendWindow(nineAmSofia, prefs), true);
});
