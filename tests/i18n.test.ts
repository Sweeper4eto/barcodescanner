import test from "node:test";
import assert from "node:assert/strict";
import { t, monthName, apiT } from "../src/i18n";

test("t resolves nested keys with interpolation", () => {
  assert.equal(t("app.greeting", { username: "alice" }), "Hello, alice");
  assert.equal(t("admin.storesCount", { stores: 2, users: 3 }), "2 stores · 3 users");
});

test("t falls back to key for unknown paths", () => {
  assert.equal(t("missing.key" as "common.appName"), "missing.key");
});

test("monthName returns English month names", () => {
  assert.equal(monthName(1), "January");
  assert.equal(monthName(12), "December");
});

test("apiT uses Accept-Language when locale is registered", () => {
  const request = new Request("http://localhost", {
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  assert.equal(apiT(request, "auth.login"), "Log in");
});
