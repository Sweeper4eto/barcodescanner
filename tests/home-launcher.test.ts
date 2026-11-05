import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HOME_LAUNCHER_TOTAL_SLOTS,
  availableHomeModules,
  defaultHomeLauncherLayout,
  moveHomeLauncherIcon,
  occupiedHomeLauncherPages,
  reconcileHomeLauncherLayout,
} from "../src/lib/home-launcher";

test("default layout packs available modules from slot 0", () => {
  const layout = defaultHomeLauncherLayout({
    schedule: true,
    team: true,
    billing: false,
    document: true,
  });
  assert.equal(layout.slots.length, HOME_LAUNCHER_TOTAL_SLOTS);
  assert.deepEqual(
    layout.slots.slice(0, 6),
    ["expiry", "schedule", "team", "contact", "document", "notifications"],
  );
  assert.equal(layout.slots[6], null);
});

test("reconcile keeps sparse positions and fills new modules into free slots", () => {
  const slots = Array.from({ length: HOME_LAUNCHER_TOTAL_SLOTS }, () => null) as
    | Array<"expiry" | "contact" | "notifications" | null>;
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
  assert.ok(availableHomeModules({
    schedule: true,
    team: false,
    billing: false,
    document: false,
  }).includes("schedule"));
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

test("occupied pages stay at 1 until an icon is on a later page", () => {
  const base = defaultHomeLauncherLayout({
    schedule: false,
    team: false,
    billing: false,
    document: false,
  });
  assert.equal(occupiedHomeLauncherPages(base), 1);
  const onPage2 = moveHomeLauncherIcon(base, 0, 9);
  assert.equal(occupiedHomeLauncherPages(onPage2), 2);
});
