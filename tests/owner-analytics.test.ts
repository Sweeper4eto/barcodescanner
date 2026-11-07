import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isWasteSpike,
  priorMonthWindow,
  thisMonthWindow,
  thisWeekWindow,
  topStaff,
  trendPercent,
  ymdUtc,
} from "../src/lib/owner-analytics";

test("trendPercent handles zero baseline", () => {
  assert.equal(trendPercent(0, 0), null);
  assert.equal(trendPercent(5, 0), 100);
  assert.equal(trendPercent(10, 5), 100);
  assert.equal(trendPercent(5, 10), -50);
});

test("isWasteSpike needs volume and growth", () => {
  assert.equal(isWasteSpike(2, 0), false);
  assert.equal(isWasteSpike(3, 0), true);
  assert.equal(isWasteSpike(10, 8), false);
  assert.equal(isWasteSpike(12, 8), true);
});

test("week/month windows are ordered", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");
  const week = thisWeekWindow(now);
  assert.ok(week.start < week.end);
  const month = thisMonthWindow(now);
  const prior = priorMonthWindow(now);
  assert.equal(ymdUtc(month.start), "2026-11-01");
  assert.equal(ymdUtc(prior.start), "2026-10-01");
  assert.equal(ymdUtc(prior.end), "2026-11-01");
});

test("topStaff aggregates and sorts", () => {
  const rows = topStaff([
    { userId: "a", username: "ana" },
    { userId: "b", username: "bob" },
    { userId: "a", username: "ana" },
    { userId: "a", username: "ana" },
  ]);
  assert.equal(rows[0]?.username, "ana");
  assert.equal(rows[0]?.count, 3);
  assert.equal(rows[1]?.username, "bob");
});
