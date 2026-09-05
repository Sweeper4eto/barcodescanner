import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeSlotOptions,
  isInQuietHours,
  isInSendWindow,
  mergeClientDefaults,
  parseTimeToMinutes,
  prefsFromUserRow,
  resolveNotifyStoreIds,
  shouldSendNotificationNow,
  snapTimeToStep,
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

test("snapTimeToStep rounds to 15 minutes", () => {
  assert.equal(snapTimeToStep("12:11"), "12:15");
  assert.equal(snapTimeToStep("12:07"), "12:00");
  assert.equal(snapTimeToStep("09:00"), "09:00");
  assert.equal(snapTimeToStep("23:59"), "00:00");
});

test("buildTimeSlotOptions has 96 quarter-hours", () => {
  const options = buildTimeSlotOptions();
  assert.equal(options.length, 96);
  assert.equal(options[0]?.value, "00:00");
  assert.equal(options[1]?.value, "00:15");
  assert.equal(options[95]?.value, "23:45");
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

test("isInSendWindow is true only near scheduled clock time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const nineAmSofia = new Date("2026-06-02T06:00:00Z");
  assert.equal(isInSendWindow(nineAmSofia, prefs), true);
  const nineOhOneSofia = new Date("2026-06-02T06:01:00Z");
  assert.equal(isInSendWindow(nineOhOneSofia, prefs), true);
  const afternoonSofia = new Date("2026-06-02T12:00:00Z");
  assert.equal(isInSendWindow(afternoonSofia, prefs), false);
});

test("isInSendWindow is false before first scheduled time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const beforeNineSofia = new Date("2026-06-02T05:30:00Z");
  assert.equal(isInSendWindow(beforeNineSofia, prefs), false);
});

test("shouldSendNotificationNow does not catch-up hours later", () => {
  const prefs = prefsFromUserRow(baseRow);
  const afternoon = new Date("2026-06-02T12:00:00Z"); // 15:00 Sofia
  assert.equal(shouldSendNotificationNow(prefs, null, afternoon), false);
});

test("shouldSendNotificationNow fires at scheduled minute", () => {
  const prefs = prefsFromUserRow(baseRow);
  const atNine = new Date("2026-06-02T06:00:30Z");
  assert.equal(shouldSendNotificationNow(prefs, null, atNine), true);
});

test("shouldSendNotificationNow skips second daily send same slot", () => {
  const prefs = prefsFromUserRow(baseRow);
  const morningSend = new Date("2026-06-02T06:00:10Z");
  const stillInWindow = new Date("2026-06-02T06:01:00Z");
  assert.equal(shouldSendNotificationNow(prefs, morningSend, stillInWindow), false);
});

test("shouldSendNotificationNow allows second slot for twice_daily", () => {
  const prefs = prefsFromUserRow({
    ...baseRow,
    expiryNotifySchedule: "twice_daily",
  });
  const morningSend = new Date("2026-06-02T06:00:10Z");
  const evening = new Date("2026-06-02T15:00:20Z"); // 18:00 Sofia
  assert.equal(shouldSendNotificationNow(prefs, morningSend, evening), true);
});

test("shouldSendNotificationNow allows next day at schedule time", () => {
  const prefs = prefsFromUserRow(baseRow);
  const yesterday = new Date("2026-06-01T06:00:10Z");
  const todayAtNine = new Date("2026-06-02T06:00:20Z");
  assert.equal(shouldSendNotificationNow(prefs, yesterday, todayAtNine), true);
});
