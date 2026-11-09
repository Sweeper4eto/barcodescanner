import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCalendarMonthsYmd,
  checklistCalendarYmd,
  checklistMonthDay,
  checklistRetentionCutoffYmd,
  checklistWeekdayIndex,
  isChecklistTaskDueOn,
  purgeChecklistRetention,
  toChecklistTaskDto,
} from "../src/lib/checklist";

test("checklistCalendarYmd returns YYYY-MM-DD", () => {
  const ymd = checklistCalendarYmd(new Date("2026-11-08T15:00:00.000Z"));
  assert.match(ymd, /^\d{4}-\d{2}-\d{2}$/);
});

test("addCalendarMonthsYmd clamps end-of-month", () => {
  assert.equal(addCalendarMonthsYmd("2026-03-31", -1), "2026-02-28");
  assert.equal(addCalendarMonthsYmd("2026-11-08", -6), "2026-05-08");
});

test("checklistRetentionCutoffYmd is 6 months back", () => {
  const cutoff = checklistRetentionCutoffYmd(
    new Date("2026-11-08T12:00:00.000Z"),
  );
  assert.equal(cutoff, "2026-05-08");
});

test("daily tasks are always due when active", () => {
  assert.equal(
    isChecklistTaskDueOn({ recurrence: "daily", active: true }, "2026-11-08"),
    true,
  );
  assert.equal(
    isChecklistTaskDueOn({ recurrence: "daily", active: false }, "2026-11-08"),
    false,
  );
});

test("once tasks due only on dueDate", () => {
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "once", dueDate: "2026-11-08", active: true },
      "2026-11-08",
    ),
    true,
  );
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "once", dueDate: "2026-11-09", active: true },
      "2026-11-08",
    ),
    false,
  );
});

test("weekly tasks match Monday=0 weekday index", () => {
  // 2026-11-08 is Sunday in Sofia → index 6
  const sunday = "2026-11-08";
  assert.equal(checklistWeekdayIndex(sunday), 6);
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "weekly", weekday: 6, active: true },
      sunday,
    ),
    true,
  );
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "weekly", weekday: 0, active: true },
      sunday,
    ),
    false,
  );
});

test("monthly tasks match calendar day", () => {
  assert.equal(checklistMonthDay("2026-11-08"), 8);
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "monthly", monthDay: 8, active: true },
      "2026-11-08",
    ),
    true,
  );
});

test("toChecklistTaskDto marks due/completed today", () => {
  const dto = toChecklistTaskDto({
    id: "t1",
    storeId: "s1",
    title: "Clean fridge",
    note: null,
    recurrence: "daily",
    dueDate: null,
    weekday: null,
    monthDay: null,
    active: true,
    inFavourites: true,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    todayYmd: "2026-11-08",
    todayCompletion: {
      completedAt: new Date("2026-11-08T08:00:00.000Z"),
      completedByUser: {
        id: "u1",
        username: "ivan",
        displayName: "Ivan",
      },
    },
  });
  assert.equal(dto.dueToday, true);
  assert.equal(dto.completedToday, true);
  assert.equal(dto.completedTodayBy?.username, "ivan");
  assert.equal(dto.inFavourites, true);
});

test("purgeChecklistRetention deletes old completions and once/inactive tasks", async () => {
  const deleted: { completions: unknown; tasks: unknown } = {
    completions: null,
    tasks: null,
  };
  const result = await purgeChecklistRetention(
    {
      checklistCompletion: {
        async deleteMany(args) {
          deleted.completions = args;
          return { count: 2 };
        },
      },
      checklistTask: {
        async deleteMany(args) {
          deleted.tasks = args;
          return { count: 1 };
        },
      },
    },
    new Date("2026-11-08T12:00:00.000Z"),
  );
  assert.equal(result.completions, 2);
  assert.equal(result.tasks, 1);
  assert.deepEqual(deleted.completions, {
    where: { dueDate: { lt: "2026-05-08" } },
  });
  assert.ok(deleted.tasks);
});
