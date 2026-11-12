import type { NextRequest } from "next/server";

type RequestLike = Pick<Request, "headers" | "url"> | NextRequest;

function configuredAppOrigin(): string | null {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function trustedHosts(): Set<string> {
  const hosts = new Set<string>();
  const app = configuredAppOrigin();
  if (app) {
    try {
      hosts.add(new URL(app).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  const extra = process.env.TRUSTED_HOSTS?.trim() ?? "";
  for (const part of extra.split(",")) {
    const host = part.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return hosts;
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

/**
 * Public origin for redirects. Prefer configured APP_URL /
 * NEXT_PUBLIC_APP_URL. Only honor Host / X-Forwarded-* when the host is
 * trusted (configured app host, TRUSTED_HOSTS, or loopback in non-prod).
 */
export function requestOrigin(request: RequestLike): string {
  const configured = configuredAppOrigin();
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = headers.get("host")?.trim();
  const candidateHost = (forwardedHost || hostHeader || "").toLowerCase();
  const trusted = trustedHosts();

  const protoHeader = (
    headers.get("x-forwarded-proto") ??
    ("nextUrl" in request && request.nextUrl
      ? request.nextUrl.protocol.replace(":", "")
      : new URL(request.url).protocol.replace(":", ""))
  )
    .split(",")[0]
    ?.trim()
    .replace(/:$/, "")
    .toLowerCase();

  const allowRequestHost =
    Boolean(candidateHost) &&
    (trusted.has(candidateHost) ||
      (process.env.NODE_ENV !== "production" && isLoopbackHost(candidateHost)));

  if (allowRequestHost && candidateHost) {
    const proto =
      protoHeader === "https" || protoHeader === "http"
        ? protoHeader
        : configured?.startsWith("https://")
          ? "https"
          : "http";
    return `${proto}://${candidateHost}`;
  }

  if (configured) return configured;

  return new URL(request.url).origin;
}

export function publicUrl(request: RequestLike, pathname: string): URL {
  return new URL(pathname, requestOrigin(request));
}
