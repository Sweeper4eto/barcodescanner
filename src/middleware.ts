import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publicUrl } from "@/lib/request-origin";
import { sessionCookieOptions } from "@/lib/session";
import {
  verifySessionToken,
  COOKIE_NAME,
  CLIENT_COOKIE_NAME,
  LEGACY_COOKIE_NAME,
} from "@/lib/session-token";

const publicPaths = ["/", "/login", "/register", "/contact", "/terms", "/privacy"];
/** Public pages that logged-in users may still open (legal / reading). */
const publicReadablePaths = ["/terms", "/privacy"];
const passwordChangePath = "/change-password";

function redirectPath(request: NextRequest, path: string) {
  return NextResponse.redirect(publicUrl(request, path));
}

function applySessionCookie(
  response: NextResponse,
  token: string,
  request: NextRequest,
) {
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions(request));
}

function finish(request: NextRequest, response: NextResponse) {
  const opts = sessionCookieOptions(request);
  const current = request.cookies.get(COOKIE_NAME)?.value;
  const legacy = request.cookies.get(LEGACY_COOKIE_NAME)?.value;
  const alreadySet = response.cookies.get(COOKIE_NAME)?.value;
  const loggingOut = request.nextUrl.pathname === "/api/auth/logout";
  if (!loggingOut && !current && legacy && !alreadySet) {
    response.cookies.set(COOKIE_NAME, legacy, opts);
  }
  if (request.cookies.has(LEGACY_COOKIE_NAME)) {
    response.cookies.set(LEGACY_COOKIE_NAME, "", { ...opts, maxAge: 0 });
  }
  if (request.cookies.has(CLIENT_COOKIE_NAME)) {
    response.cookies.set(CLIENT_COOKIE_NAME, "", {
      ...opts,
      httpOnly: false,
      maxAge: 0,
    });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/auth/")
  ) {
    return finish(request, NextResponse.next());
  }

  // Never bootstrap a session from query-string JWTs (?__session= / ?t=).
  // Login uses /auth/establish with an opaque ticket + Set-Cookie on a 200.

  const token =
    request.cookies.get(COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/app") && !session) {
    console.warn("[middleware] /app blocked — no session cookie");
  }

  if (session?.mustChangePassword) {
    if (pathname === passwordChangePath || pathname === "/login") {
      return finish(request, NextResponse.next());
    }
    return finish(request, redirectPath(request, passwordChangePath));
  }

  if (pathname === passwordChangePath) {
    if (!session) {
      return finish(request, redirectPath(request, "/login"));
    }
    return finish(request, NextResponse.next());
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return finish(request, redirectPath(request, "/login"));
    }
    if (session.role !== "ADMIN") {
      return finish(request, redirectPath(request, "/app"));
    }
    return finish(request, NextResponse.next());
  }

  if (pathname.startsWith("/app")) {
    if (!session) {
      return finish(request, redirectPath(request, "/login"));
    }
    if (session.role === "ADMIN") {
      return finish(request, redirectPath(request, "/admin"));
    }
    return finish(request, NextResponse.next());
  }

  if (publicPaths.includes(pathname)) {
    if (publicReadablePaths.includes(pathname)) {
      return finish(request, NextResponse.next());
    }
    if (session?.role === "ADMIN") {
      return finish(request, redirectPath(request, "/admin"));
    }
    if (session?.role === "USER" && session.clientId) {
      // Logged-in users land on in-app support, not the icon hub.
      if (pathname === "/contact") {
        const target = `/app/contact${request.nextUrl.search}`;
        return finish(request, redirectPath(request, target));
      }
      return finish(request, redirectPath(request, "/app"));
    }
  }

  return finish(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
