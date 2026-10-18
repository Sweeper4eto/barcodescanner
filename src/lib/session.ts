import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

export {
  CLIENT_COOKIE_NAME,
  COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
};

let testSessionToken: string | undefined;

export function setTestSessionToken(token: string | undefined): void {
  testSessionToken = token;
}

export async function getSession(): Promise<SessionPayload | null> {
  if (process.env.TEST_MODE === "1" && testSessionToken) {
    return verifySessionToken(testSessionToken);
  }

  const cookieStore = await cookies();
  const current = cookieStore.get(COOKIE_NAME)?.value;
  const legacy = cookieStore.get(LEGACY_COOKIE_NAME)?.value;
  const token = current || legacy;
  if (!token) return null;
  if (!current && legacy) {
    try {
      cookieStore.set(COOKIE_NAME, legacy, sessionCookieOptions());
    } catch {
      /* Cookie store is read-only here. Middleware still accepts the old name. */
    }
  }
  return verifySessionToken(token);
}

function sessionCookieSecure(request?: Request): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "true") return true;
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;

  if (request) {
    const proto = (
      request.headers.get("x-forwarded-proto") ??
      new URL(request.url).protocol.replace(":", "")
    ).toLowerCase();
    if (proto === "https") return true;
    if (proto === "http") return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  return appUrl.startsWith("https://");
}

export function sessionCookieOptions(request?: Request) {
  const secure = sessionCookieSecure(request);
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

function clearRetiredSessionCookies(
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      sameSite: "lax";
      secure: boolean;
      path: string;
      maxAge: number;
    },
  ) => void,
  request?: Request,
) {
  const secure = sessionCookieSecure(request);
  set(LEGACY_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  set(CLIENT_COOKIE_NAME, "", {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

export async function setSessionCookie(
  token: string,
  request?: Request,
): Promise<void> {
  if (process.env.TEST_MODE === "1") {
    setTestSessionToken(token);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions(request));
  clearRetiredSessionCookies((name, value, options) => {
    cookieStore.set(name, value, options);
  }, request);
}

/** Attach the httpOnly session cookie and expire the older magazin cookie names. */
export function applySessionCookie(
  response: NextResponse,
  token: string,
  request?: Request,
): void {
  if (process.env.TEST_MODE === "1") {
    setTestSessionToken(token);
    return;
  }
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions(request));
  clearRetiredSessionCookies((name, value, options) => {
    response.cookies.set(name, value, options);
  }, request);
}

export async function clearSessionCookie(request?: Request): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    ...sessionCookieOptions(request),
    maxAge: 0,
  });
  clearRetiredSessionCookies((name, value, options) => {
    cookieStore.set(name, value, options);
  }, request);
}
