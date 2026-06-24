import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/client";

const COOKIE_NAME = "magazin_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type SessionPayload = {
  userId: string;
  username: string;
  role: Role;
  clientId: string | null;
};

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "USER")
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      clientId: typeof payload.clientId === "string" ? payload.clientId : null,
    };
  } catch {
    return null;
  }
}

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

export { COOKIE_NAME };
