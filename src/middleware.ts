import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { publicUrl } from "@/lib/request-origin";

const publicPaths = ["/", "/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/uploads")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(publicUrl(request, "/login"));
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(publicUrl(request, "/app"));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/app")) {
    if (!session) {
      return NextResponse.redirect(publicUrl(request, "/login"));
    }
    if (session.role === "ADMIN") {
      return NextResponse.redirect(publicUrl(request, "/admin"));
    }
    return NextResponse.next();
  }

  if (publicPaths.includes(pathname)) {
    if (session?.role === "ADMIN") {
      return NextResponse.redirect(publicUrl(request, "/admin"));
    }
    if (session?.role === "USER" && session.clientId) {
      return NextResponse.redirect(publicUrl(request, "/app"));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
