import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowAppBottomNav } from "../src/lib/app-navigation";

test("hides bottom nav on home hub and other launcher screens", () => {
  assert.equal(shouldShowAppBottomNav("/app"), false);
  assert.equal(shouldShowAppBottomNav("/app/"), false);
  assert.equal(shouldShowAppBottomNav("/app/team"), false);
  assert.equal(shouldShowAppBottomNav("/app/contact"), false);
  assert.equal(shouldShowAppBottomNav("/app/billing"), false);
  assert.equal(shouldShowAppBottomNav("/app/schedule"), false);
  assert.equal(shouldShowAppBottomNav("/app/settings/notifications"), false);
});

test("shows bottom nav inside the expiry work flow", () => {
  assert.equal(shouldShowAppBottomNav("/app/expiry"), true);
  assert.equal(shouldShowAppBottomNav("/app/scan"), true);
  assert.equal(shouldShowAppBottomNav("/app/add-product"), true);
  assert.equal(shouldShowAppBottomNav("/app/orders"), true);
  assert.equal(shouldShowAppBottomNav("/app/buy-list"), true);
  assert.equal(shouldShowAppBottomNav("/app/add-document"), true);
});
