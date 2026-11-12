import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requestOrigin } from "../src/lib/request-origin";

const prev = {
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TRUSTED_HOSTS: process.env.TRUSTED_HOSTS,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("requestOrigin prefers configured APP_URL over spoofed forwarded host", () => {
  process.env.NODE_ENV = "production";
  process.env.APP_URL = "https://expire365.com";
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.TRUSTED_HOSTS;

  const request = new Request("https://expire365.com/login", {
    headers: {
      host: "expire365.com",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(requestOrigin(request), "https://expire365.com");
});

test("requestOrigin allows TRUSTED_HOSTS", () => {
  process.env.NODE_ENV = "production";
  process.env.APP_URL = "https://expire365.com";
  process.env.TRUSTED_HOSTS = "app.expire365.com";

  const request = new Request("https://expire365.com/login", {
    headers: {
      host: "expire365.com",
      "x-forwarded-host": "app.expire365.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(requestOrigin(request), "https://app.expire365.com");
});
