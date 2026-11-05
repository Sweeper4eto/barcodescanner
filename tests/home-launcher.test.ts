import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_LAUNCHER_SLOTS_PER_PAGE,
  HOME_LAUNCHER_TOTAL_SLOTS,
  availableHomeModules,
  defaultHomeLauncherLayout,
  emptyLauncherSlots,
  moveHomeLauncherIcon,
  occupiedHomeLauncherPages,
  reconcileHomeLauncherLayout,
} from "../src/lib/home-launcher";

test("default layout packs active on page 1 and locked on page 2", () => {
  const layout = defaultHomeLauncherLayout({
    schedule: true,
    team: true,
    billing: false,
    document: true,
  });
  assert.equal(layout.slots.length, HOME_LAUNCHER_TOTAL_SLOTS);
  assert.deepEqual(layout.slots.slice(0, 6), [
    "expiry",
    "schedule",
    "team",
    "contact",
    "document",
    "notifications",
  ]);
  assert.equal(layout.slots[6], null);
  assert.equal(layout.slots[7], null);
  assert.equal(layout.slots[8], null);
  assert.deepEqual(
    layout.slots.slice(
      HOME_LAUNCHER_SLOTS_PER_PAGE,
      HOME_LAUNCHER_SLOTS_PER_PAGE + 4,
    ),
    ["analytics", "journal", "checklists", "temperature"],
  );
});

test("reconcile keeps sparse active positions and fills new active on page 1", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[4] = "contact";
  slots[8] = "notifications";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: true,
      team: false,
      billing: false,
      document: false,
    },
  );

  assert.equal(next.slots[0], "expiry");
  assert.equal(next.slots[4], "contact");
  assert.equal(next.slots[8], "notifications");
  assert.equal(next.slots[1], "schedule");
  assert.ok(
    availableHomeModules({
      schedule: true,
      team: false,
      billing: false,
      document: false,
    }).includes("schedule"),
  );
  assert.deepEqual(
    next.slots.slice(
      HOME_LAUNCHER_SLOTS_PER_PAGE,
      HOME_LAUNCHER_SLOTS_PER_PAGE + 4,
    ),
    ["analytics", "journal", "checklists", "temperature"],
  );
});

test("newly enabled active module takes page 1 and pushes locked to page 2", () => {
  const slots = emptyLauncherSlots();
  slots[0] = "expiry";
  slots[1] = "contact";
  slots[2] = "notifications";
  slots[3] = "analytics";
  slots[4] = "journal";

  const next = reconcileHomeLauncherLayout(
    { slots },
    {
      schedule: false,
      team: false,
      billing: true,
      document: false,
    },
  );

  assert.equal(next.slots[0], "expiry");
  assert.equal(next.slots[1], "contact");
  assert.equal(next.slots[2], "notifications");
  assert.equal(next.slots[3], "billing");
  assert.ok(!next.slots.slice(0, HOME_LAUNCHER_SLOTS_PER_PAGE).includes("analytics"));
  assert.ok(next.slots.slice(HOME_LAUNCHER_SLOTS_PER_PAGE).includes("analytics"));
  assert.ok(next.slots.slice(HOME_LAUNCHER_SLOTS_PER_PAGE).includes("journal"));
});

test("move swaps or places into empty slot", () => {
  const base = defaultHomeLauncherLayout({
    schedule: false,
    team: false,
    billing: false,
    document: false,
  });
  // expiry at 0, contact at 1, notifications at 2
  const moved = moveHomeLauncherIcon(base, 0, 8);
  assert.equal(moved.slots[8], "expiry");
  assert.equal(moved.slots[0], null);

  const swapped = moveHomeLauncherIcon(base, 0, 1);
  assert.equal(swapped.slots[0], "contact");
  assert.equal(swapped.slots[1], "expiry");
});

test("occupied pages include locked page-2 tiles", () => {
  const base = defaultHomeLauncherLayout({
    schedule: false,
    team: false,
    billing: false,
    document: false,
  });
  assert.equal(occupiedHomeLauncherPages(base), 2);
  const onPage3 = moveHomeLauncherIcon(base, HOME_LAUNCHER_SLOTS_PER_PAGE, 18);
  assert.equal(occupiedHomeLauncherPages(onPage3), 3);
});
