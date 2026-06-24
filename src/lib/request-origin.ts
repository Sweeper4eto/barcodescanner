import type { NextRequest } from "next/server";

export function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");

  if (host) {
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

export function publicUrl(request: NextRequest, pathname: string): URL {
  return new URL(pathname, requestOrigin(request));
}
