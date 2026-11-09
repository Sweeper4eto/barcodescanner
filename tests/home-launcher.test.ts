import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_LAUNCHER_SLOTS_PER_PAGE,
  HOME_LAUNCHER_TOTAL_SLOTS,
  availableHomeModules,
  clearHomeLauncherLayoutCache,
  defaultHomeLauncherLayout,
  emptyLauncherSlots,
  homeLauncherLayoutsEqual,
  mergeHiddenOptionalSlots,
  moveHomeLauncherIcon,
  occupiedHomeLauncherPages,
  readHomeLauncherLayout,
  reconcileHomeLauncherLayout,
  writeHomeLauncherLayout,
} from "../src/lib/home-launcher";

test("default page-1 layout matches product order with gaps", () => {
  const layout = defaultHomeLauncherLayout({
    schedule: false,
    team: true,
    billing: true,
    analytics: true,
    checklists: true,
  });
  assert.equal(layout.slots.length, HOME_LAUNCHER_TOTAL_SLOTS);
  assert.deepEqual(layout.slots.slice(0, 9), [
    "expiry",
    "team",
    "notifications",
    null,
    null,
    null,
    "contact",
    null,
    "billing",
  ]);
  assert.equal(layout.slots[HOME_LAUNCHER_SLOTS_PER_PAGE], "analytics");
  assert.deepEqual(
    layout.slots.slice(
      HOME_LAUNCHER_SLOTS_PER_PAGE + 1,
      HOME_LAUNCHER_SLOTS_PER_PAGE + 4,
    ),
    ["journal", "checklists", "temperature"],
  );
});

test("default puts schedule at page-1 position 8; Soon stay on page 2", () => {
  const layout = defaultHomeLauncherLayout({
    schedule: true,
    team: false,
    billing: false,
    analytics: false,
    checklists: true,
  });
  assert.equal(layout.slots[0], "expiry");
  assert.equal(layout.slots[1], null);
  assert.equal(layout.slots[2], "notifications");
  assert.equal(layout.slots[6], "contact");
  assert.equal(layout.slots[7], "schedule");
  assert.equal(layout.slots[8], null);
  assert.equal(layout.slots[HOME_LAUNCHER_SLOTS_PER_PAGE], null);
  assert.deepEqual(
    layout.slots.slice(
      HOME_LAUNCHER_SLOTS_PER_PAGE + 1,
      HOME_LAUNCHER_SLOTS_PER_PAGE + 4,
    ),
    ["journal", "checklists", "temperature"],
  );
  assert.ok(
    !availableHomeModules({
      schedule: true,
      team: false,
      billing: false,
      analytics: false,
      checklists: true,
    }).includes("analytics"),
  );
  assert.ok(
    availableHomeModules({
      schedule: true,
      team: false,
      billing: false,
      analytics: false,
      checklists: true,
    }).includes("schedule"),
  );
});

test("analytics tile is owner-only in available modules", () => {
  assert.ok(
    availableHomeModules({
      schedule: false,
      team: true,
      billing: false,
      analytics: true,
      checklists: true,
    }).includes("analytics"),
  );
  assert.ok(
    !availableHomeModules({
      schedule: false,
      team: true,
      billing: false,
      analytics: false,
      checklists: true,
    }).includes("analytics"),
  );
});

test("checklists tile is retail-only in available modules", () => {
  assert.ok(
    availableHomeModules({
      schedule: false,
      team: true,
      billing: false,
      analytics: false,
      checklists: true,
    }).includes("checklists"),
  );
  assert.ok(
    !availableHomeModules({
      schedule: false,
      team: true,
      billing: false,
      analytics: false,
      checklists: false,
    }).includes("checklists"),
  );
});

test("reconcile with no saved layout uses defaults", () => {
  const next = reconcileHomeLauncherLayout(null, {
    schedule: false,
    team: true,
    billing: true,
    analytics: true,
    checklists: true,
  });
  assert.deepEqual(next.slots.slice(0, 9), [
    "expiry",
    "team",
    "notifications",
    null,
    null,
    null,
    "contact",
    null,
    "billing",
  ]);
});

test("reconcile keeps sparse active positions and places new in preferred slot", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[6] = "contact";
  slots[2] = "notifications";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: true,
      billing: false,
      analytics: true,
      checklists: true,
    },
  );

  assert.equal(next.slots[0], "expiry");
  assert.equal(next.slots[6], "contact");
  assert.equal(next.slots[2], "notifications");
  assert.equal(next.slots[1], "team");
  assert.equal(next.slots[HOME_LAUNCHER_SLOTS_PER_PAGE], "analytics");
  assert.deepEqual(
    next.slots.slice(
      HOME_LAUNCHER_SLOTS_PER_PAGE + 1,
      HOME_LAUNCHER_SLOTS_PER_PAGE + 4,
    ),
    ["journal", "checklists", "temperature"],
  );
});

test("newly enabled billing takes preferred slot 9 without packing gaps", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[2] = "notifications";
  slots[6] = "contact";
  slots[HOME_LAUNCHER_SLOTS_PER_PAGE] = "analytics";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: true,
      billing: true,
      analytics: true,
      checklists: true,
    },
  );

  assert.equal(next.slots[8], "billing");
  assert.equal(next.slots[1], "team");
  assert.equal(next.slots[3], null);
  assert.equal(next.slots[4], null);
  assert.equal(next.slots[5], null);
  assert.equal(next.slots[7], null);
  assert.ok(next.slots.slice(HOME_LAUNCHER_SLOTS_PER_PAGE).includes("analytics"));
});

test("move swaps or places into empty slot", () => {
  const base = defaultHomeLauncherLayout({
    schedule: false,
    team: false,
    billing: false,
    analytics: false,
    checklists: true,
  });
  // expiry at 0, notifications at 2, contact at 6
  const moved = moveHomeLauncherIcon(base, 0, 8);
  assert.equal(moved.slots[8], "expiry");
  assert.equal(moved.slots[0], null);

  const swapped = moveHomeLauncherIcon(base, 0, 2);
  assert.equal(swapped.slots[0], "notifications");
  assert.equal(swapped.slots[2], "expiry");
});

test("occupied pages include locked page-2 tiles", () => {
  const base = defaultHomeLauncherLayout({
    schedule: false,
    team: false,
    billing: false,
    analytics: false,
    checklists: true,
  });
  assert.equal(occupiedHomeLauncherPages(base), 2);
  const onPage3 = moveHomeLauncherIcon(
    base,
    HOME_LAUNCHER_SLOTS_PER_PAGE + 1,
    18,
  );
  assert.equal(occupiedHomeLauncherPages(onPage3), 3);
});

test("legacy document tile is dropped from saved layouts", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[1] = "document" as (typeof slots)[number];
  slots[6] = "contact";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: false,
      billing: false,
      analytics: false,
      checklists: true,
    },
  );

  assert.equal(next.slots[0], "expiry");
  assert.equal(next.slots[6], "contact");
  assert.equal(next.slots[2], "notifications");
  assert.ok(!next.slots.some((id) => id === ("document" as never)));
});

test("reconcile keeps Soon tiles moved onto page 1", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[2] = "notifications";
  slots[3] = "analytics";
  slots[6] = "contact";
  slots[HOME_LAUNCHER_SLOTS_PER_PAGE + 1] = "journal";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: true,
      billing: false,
      analytics: true,
      checklists: true,
    },
  );

  assert.equal(next.slots[3], "analytics");
  assert.equal(next.slots[HOME_LAUNCHER_SLOTS_PER_PAGE + 1], "journal");
  assert.ok(next.slots.includes("checklists"));
  assert.ok(next.slots.includes("temperature"));
});

test("reconcile drops analytics for non-owners", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[HOME_LAUNCHER_SLOTS_PER_PAGE] = "analytics";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: false,
      billing: false,
      analytics: false,
      checklists: false,
    },
  );

  assert.ok(!next.slots.includes("analytics"));
  assert.ok(!next.slots.includes("checklists"));
});

test("mergeHiddenOptionalSlots keeps billing while availability omits it", () => {
  const previous = emptyLauncherSlots();
  previous[0] = "expiry";
  previous[4] = "billing";
  previous[6] = "contact";

  const display = emptyLauncherSlots();
  display[0] = "expiry";
  display[6] = "contact";
  display[2] = "notifications";

  const merged = mergeHiddenOptionalSlots(
    { slots: display },
    { slots: previous },
    {
      schedule: false,
      team: false,
      billing: false,
      analytics: false,
      checklists: false,
    },
  );

  assert.equal(merged.slots[4], "billing");
  assert.equal(merged.slots[0], "expiry");
  assert.equal(merged.slots[6], "contact");
});

test("write then read keeps exact rearranged slots (memory + equality)", () => {
  clearHomeLauncherLayoutCache();
  const username = "__layout_persist_test__";
  const slots = emptyLauncherSlots();
  slots[3] = "expiry";
  slots[0] = "contact";
  slots[8] = "notifications";
  slots[HOME_LAUNCHER_SLOTS_PER_PAGE] = "analytics";
  writeHomeLauncherLayout(username, { slots });

  const loaded = readHomeLauncherLayout(username);
  assert.ok(loaded);
  assert.ok(homeLauncherLayoutsEqual(loaded!, { slots }));

  const shown = reconcileHomeLauncherLayout(loaded, {
    schedule: false,
    team: true,
    billing: false,
    analytics: true,
    checklists: true,
  });
  assert.equal(shown.slots[3], "expiry");
  assert.equal(shown.slots[0], "contact");
  assert.equal(shown.slots[8], "notifications");
  assert.equal(shown.slots[HOME_LAUNCHER_SLOTS_PER_PAGE], "analytics");
  clearHomeLauncherLayoutCache(username);
});
