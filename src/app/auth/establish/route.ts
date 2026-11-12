import { NextResponse } from "next/server";
import { resolveLoginTicket } from "@/lib/login-tickets";
import {
  applySessionCookie,
  COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  sessionCookieOptions,
} from "@/lib/session";
import { verifySessionToken } from "@/lib/session-token";
import { publicUrl } from "@/lib/request-origin";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(publicUrl(request, path), 303);
}

function cookieFrom(request: Request, name: string): string {
  const raw = request.headers.get("cookie") ?? "";
  const parts = raw.split(/;\s*/);
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i) === name) {
      return decodeURIComponent(part.slice(i + 1));
    }
  }
  return "";
}

/**
 * 200 HTML bounce with Set-Cookie — more reliable on mobile Safari than a
 * 303 that may drop the cookie. No JWT in the destination URL.
 */
function finishWithSession(
  request: Request,
  token: string,
  nextPath: string,
) {
  const dest = publicUrl(request, nextPath).toString();
  const safeDest = JSON.stringify(dest);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0;url=${dest.replace(/"/g, "")}"/><title>Signing in</title></head><body><script>location.replace(${safeDest})</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  applySessionCookie(response, token, request);
  // Reinforce path/options on this document response.
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions(request));
  return response;
}

async function establish(request: Request) {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("k")?.trim() ?? "";
  const next = url.searchParams.get("next")?.trim() || "/app";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  // Opaque tickets only — legacy ?t=<JWT> is rejected.
  const token = ticketId ? resolveLoginTicket(ticketId) : null;

  if (!token) {
    const existing =
      cookieFrom(request, COOKIE_NAME) ||
      cookieFrom(request, LEGACY_COOKIE_NAME);
    if (existing && (await verifySessionToken(existing))) {
      return finishWithSession(request, existing, safeNext);
    }
    return redirectTo(request, "/login?error=credentials");
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return redirectTo(request, "/login?error=credentials");
  }

  return finishWithSession(request, token, safeNext);
}

export async function GET(request: Request) {
  try {
    return await establish(request);
  } catch (error) {
    console.error("[auth/establish]", error);
    return redirectTo(request, "/login?error=credentials");
  }
}

export async function POST(request: Request) {
  return GET(request);
}
