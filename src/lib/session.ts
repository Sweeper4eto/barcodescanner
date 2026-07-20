import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

export {
  COOKIE_NAME,
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
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function sessionCookieSecure(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "true") return true;
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  return appUrl.startsWith("https://");
}

export async function setSessionCookie(token: string): Promise<void> {
  if (process.env.TEST_MODE === "1") {
    setTestSessionToken(token);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 0,
  });
}
