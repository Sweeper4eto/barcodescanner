import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCalendarDaysYmd,
  addCalendarMonthsYmd,
  checklistCalendarYmd,
  checklistCompletionWindowStartYmd,
  checklistMonthDay,
  checklistMonthEndYmd,
  checklistMonthStartYmd,
  checklistPeriodBounds,
  checklistRetentionCutoffYmd,
  checklistWeekEndYmd,
  checklistWeekStartYmd,
  checklistWeekdayIndex,
  completionInChecklistPeriod,
  isChecklistTaskDueOn,
  normalizeChecklistFields,
  pickChecklistPeriodCompletion,
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

test("addCalendarDaysYmd crosses month boundaries", () => {
  assert.equal(addCalendarDaysYmd("2026-11-01", -1), "2026-10-31");
  assert.equal(addCalendarDaysYmd("2026-11-08", 0), "2026-11-08");
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

test("weekly tasks are due any day of the week", () => {
  // 2026-11-08 is Sunday in Sofia → index 6
  const sunday = "2026-11-08";
  assert.equal(checklistWeekdayIndex(sunday), 6);
  assert.equal(checklistWeekStartYmd(sunday), "2026-11-02");
  assert.equal(checklistWeekEndYmd(sunday), "2026-11-08");
  assert.equal(
    isChecklistTaskDueOn({ recurrence: "weekly", active: true }, sunday),
    true,
  );
  assert.equal(
    isChecklistTaskDueOn(
      { recurrence: "weekly", active: true },
      "2026-11-04",
    ),
    true,
  );
});

test("monthly tasks are due any day of the month", () => {
  assert.equal(checklistMonthDay("2026-11-08"), 8);
  assert.equal(checklistMonthStartYmd("2026-11-08"), "2026-11-01");
  assert.equal(checklistMonthEndYmd("2026-11-08"), "2026-11-30");
  assert.equal(
    isChecklistTaskDueOn({ recurrence: "monthly", active: true }, "2026-11-01"),
    true,
  );
  assert.equal(
    isChecklistTaskDueOn({ recurrence: "monthly", active: true }, "2026-11-30"),
    true,
  );
});

test("normalizeChecklistFields drops weekday/monthDay for weekly and monthly", () => {
  assert.deepEqual(
    normalizeChecklistFields({
      recurrence: "weekly",
      weekday: 3,
      monthDay: 10,
    }),
    {
      recurrence: "weekly",
      dueDate: null,
      weekday: null,
      monthDay: null,
    },
  );
  assert.deepEqual(
    normalizeChecklistFields({
      recurrence: "monthly",
      weekday: 1,
      monthDay: 15,
    }),
    {
      recurrence: "monthly",
      dueDate: null,
      weekday: null,
      monthDay: null,
    },
  );
});

test("period completion matches week and month windows", () => {
  assert.equal(
    completionInChecklistPeriod("2026-11-03", "weekly", "2026-11-08"),
    true,
  );
  assert.equal(
    completionInChecklistPeriod("2026-11-01", "weekly", "2026-11-08"),
    false,
  );
  assert.equal(
    completionInChecklistPeriod("2026-11-15", "monthly", "2026-11-08"),
    true,
  );
  assert.equal(
    completionInChecklistPeriod("2026-10-31", "monthly", "2026-11-08"),
    false,
  );
  assert.equal(
    checklistCompletionWindowStartYmd("2026-11-08"),
    "2026-11-01",
  );
});

test("pickChecklistPeriodCompletion prefers newest in period", () => {
  const picked = pickChecklistPeriodCompletion(
    [
      {
        dueDate: "2026-11-03",
        completedAt: new Date("2026-11-03T08:00:00.000Z"),
      },
      {
        dueDate: "2026-11-05",
        completedAt: new Date("2026-11-05T10:00:00.000Z"),
      },
    ],
    "weekly",
    "2026-11-08",
  );
  assert.equal(picked?.dueDate, "2026-11-05");
});

test("toChecklistTaskDto marks due/completed for period", () => {
  const dto = toChecklistTaskDto({
    id: "t1",
    storeId: "s1",
    title: "Clean fridge",
    note: "Wipe shelves",
    comment: "Done left side",
    recurrence: "weekly",
    dueDate: null,
    weekday: null,
    monthDay: null,
    active: true,
    inFavourites: true,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    todayYmd: "2026-11-08",
    todayCompletion: {
      completedAt: new Date("2026-11-05T08:00:00.000Z"),
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
  assert.equal(dto.note, "Wipe shelves");
  assert.equal(dto.comment, "Done left side");
});

test("checklistPeriodBounds for daily is the day itself", () => {
  assert.deepEqual(checklistPeriodBounds("daily", "2026-11-08"), {
    start: "2026-11-08",
    end: "2026-11-08",
  });
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
