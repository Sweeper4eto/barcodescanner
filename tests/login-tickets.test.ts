import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearLoginTicket,
  createLoginTicket,
  resolveLoginTicket,
} from "../src/lib/login-tickets";

test("login ticket resolves and allows short grace reuse", () => {
  const id = createLoginTicket("session-token-abc");
  assert.equal(resolveLoginTicket(id), "session-token-abc");
  assert.equal(resolveLoginTicket(id), "session-token-abc");
});

test("unknown or cleared ticket returns null", () => {
  assert.equal(resolveLoginTicket("missing"), null);
  const id = createLoginTicket("tok");
  clearLoginTicket(id);
  assert.equal(resolveLoginTicket(id), null);
});
