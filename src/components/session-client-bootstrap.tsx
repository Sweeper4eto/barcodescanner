"use client";

import { useEffect } from "react";
import { CLIENT_COOKIE_NAME } from "@/lib/session-token";

/**
 * Drop a leftover JS-readable session cookie and strip ?__session= from the
 * address bar. The httpOnly cookie is set by the server on this response.
 */
export function SessionClientBootstrap() {
  useEffect(() => {
    try {
      document.cookie = `${CLIENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
      sessionStorage.removeItem(CLIENT_COOKIE_NAME);
      const url = new URL(window.location.href);
      if (!url.searchParams.has("__session")) return;
      url.searchParams.delete("__session");
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", clean);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
