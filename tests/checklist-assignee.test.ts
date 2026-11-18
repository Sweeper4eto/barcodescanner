import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canViewChecklistTask,
  checklistVisibilityWhere,
} from "../src/lib/checklist";

test("staff sees only Everyone and own assigned tasks", () => {
  assert.equal(
    canViewChecklistTask({ assigneeUserId: null }, "u1", false),
    true,
  );
  assert.equal(
    canViewChecklistTask({ assigneeUserId: "u1" }, "u1", false),
    true,
  );
  assert.equal(
    canViewChecklistTask({ assigneeUserId: "u2" }, "u1", false),
    false,
  );
});

test("owners can view any assignee", () => {
  assert.equal(
    canViewChecklistTask({ assigneeUserId: "u2" }, "owner", true),
    true,
  );
});

test("visibility where is empty for owners", () => {
  assert.deepEqual(checklistVisibilityWhere("owner", true), {});
});

test("visibility where filters for staff", () => {
  assert.deepEqual(checklistVisibilityWhere("u1", false), {
    OR: [{ assigneeUserId: null }, { assigneeUserId: "u1" }],
  });
});
