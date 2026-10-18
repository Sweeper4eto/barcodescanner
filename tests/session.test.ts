import test from "node:test";
import assert from "node:assert/strict";
import { setupTestEnv } from "./helpers/db";

setupTestEnv();

test("createSessionToken and verifySessionToken round-trip", async () => {
  const { createSessionToken, verifySessionToken } = await import("../src/lib/session");
  const token = await createSessionToken({
    userId: "user-1",
    username: "alice",
    role: "USER",
    clientId: "client-1",
  });

  const payload = await verifySessionToken(token);
  assert.deepEqual(payload, {
    userId: "user-1",
    username: "alice",
    role: "USER",
    clientId: "client-1",
    mustChangePassword: false,
  });
});

test("verifySessionToken returns null for invalid token", async () => {
  const { verifySessionToken } = await import("../src/lib/session");
  assert.equal(await verifySessionToken("not-a-valid-token"), null);
});

test("applySessionCookie sets only the httpOnly session cookie", async () => {
  const previous = process.env.TEST_MODE;
  delete process.env.TEST_MODE;
  try {
    const { NextResponse } = await import("next/server");
    const {
      applySessionCookie,
      createSessionToken,
      COOKIE_NAME,
      CLIENT_COOKIE_NAME,
      LEGACY_COOKIE_NAME,
    } = await import("../src/lib/session");
    const token = await createSessionToken({
      userId: "user-1",
      username: "alice",
      role: "USER",
      clientId: "client-1",
    });
    const response = NextResponse.next();
    applySessionCookie(response, token, new Request("http://127.0.0.1/app"));
    const names = response.cookies.getAll().map((cookie) => cookie.name);
    assert.equal(COOKIE_NAME, "expire365_session");
    assert.equal(names.includes(COOKIE_NAME), true);
    assert.equal(names.includes(CLIENT_COOKIE_NAME), true);
    assert.equal(names.includes(LEGACY_COOKIE_NAME), true);
    assert.equal(response.cookies.get(COOKIE_NAME)?.value, token);
    assert.equal(response.cookies.get(COOKIE_NAME)?.httpOnly, true);
    assert.equal(response.cookies.get(CLIENT_COOKIE_NAME)?.value, "");
    assert.equal(response.cookies.get(CLIENT_COOKIE_NAME)?.httpOnly, false);
    assert.equal(response.cookies.get(LEGACY_COOKIE_NAME)?.value, "");
    assert.equal(response.cookies.get(LEGACY_COOKIE_NAME)?.httpOnly, true);
  } finally {
    process.env.TEST_MODE = previous;
  }
});

test("verifySessionToken returns null for tampered token", async () => {
  const { createSessionToken, verifySessionToken } = await import("../src/lib/session");
  const token = await createSessionToken({
    userId: "user-1",
    username: "alice",
    role: "ADMIN",
    clientId: null,
  });
  assert.equal(await verifySessionToken(`${token}x`), null);
});
