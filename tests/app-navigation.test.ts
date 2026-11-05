import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowAppBottomNav } from "../src/lib/app-navigation";

test("classic UI always shows bottom nav", () => {
  assert.equal(shouldShowAppBottomNav("/app"), true);
  assert.equal(shouldShowAppBottomNav("/app/team"), true);
  assert.equal(shouldShowAppBottomNav("/app/contact", { newUiEnabled: false }), true);
});

test("new UI hides bottom nav on home hub and other launcher screens", () => {
  const opts = { newUiEnabled: true };
  assert.equal(shouldShowAppBottomNav("/app", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/team", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/contact", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/billing", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/schedule", opts), false);
  assert.equal(shouldShowAppBottomNav("/app/settings/notifications", opts), false);
});

test("new UI shows bottom nav inside the expiry work flow", () => {
  const opts = { newUiEnabled: true };
  assert.equal(shouldShowAppBottomNav("/app/expiry", opts), true);
  assert.equal(shouldShowAppBottomNav("/app/scan", opts), true);
  assert.equal(shouldShowAppBottomNav("/app/add-product", opts), true);
  assert.equal(shouldShowAppBottomNav("/app/orders", opts), true);
  assert.equal(shouldShowAppBottomNav("/app/buy-list", opts), true);
  assert.equal(shouldShowAppBottomNav("/app/add-document", opts), true);
});
