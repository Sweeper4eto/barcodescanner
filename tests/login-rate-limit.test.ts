import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLoginFailures,
  getLoginLockRemainingMs,
  recordLoginFailure,
} from "../src/lib/login-rate-limit";

test("login rate limit locks after repeated failures", () => {
  const ip = "203.0.113.10";
  const username = "rate-limit-user";
  clearLoginFailures(ip, username);

  assert.equal(getLoginLockRemainingMs(ip, username), 0);

  for (let i = 0; i < 7; i += 1) {
    assert.equal(recordLoginFailure(ip, username), 0);
  }

  const lockedFor = recordLoginFailure(ip, username);
  assert.ok(lockedFor > 0);
  assert.ok(getLoginLockRemainingMs(ip, username) > 0);

  clearLoginFailures(ip, username);
  assert.equal(getLoginLockRemainingMs(ip, username), 0);
});
