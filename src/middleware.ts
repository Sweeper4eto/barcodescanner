import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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
const SESSION_QUERY = "__session";

function publicOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = (
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "")
  ).replace(/:$/, "");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function redirectPath(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, publicOrigin(request)));
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
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/auth/")
  ) {
    return finish(request, NextResponse.next());
  }

  // Phone/Safari often drops Set-Cookie on redirects. Bootstrap the httpOnly
  // cookie from ?__session= on this document response (200), not on a 302.
  // Router prefetches/RSC fetches of the same URL must not bootstrap: they would
  // hand the session back after a logout, since the token lingers in the URL.
  const isRscRequest = request.headers.get("rsc") !== null;
  const bootstrapToken = isRscRequest
    ? ""
    : (searchParams.get(SESSION_QUERY)?.trim() ?? "");
  if (bootstrapToken) {
    const bootSession = await verifySessionToken(bootstrapToken);
    if (bootSession) {
      const response = NextResponse.next();
      applySessionCookie(response, bootstrapToken, request);
      console.info("[middleware] session bootstrap ok →", pathname);
      return finish(request, response);
    }
    console.warn("[middleware] session bootstrap failed");
    return finish(request, redirectPath(request, "/login?error=credentials"));
  }

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
      return finish(request, redirectPath(request, "/app"));
    }
  }

  return finish(request, NextResponse.next());
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
