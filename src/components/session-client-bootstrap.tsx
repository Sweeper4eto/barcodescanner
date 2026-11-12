"use client";

import { useEffect } from "react";
import { CLIENT_COOKIE_NAME } from "@/lib/session-token";

/**
 * Drop a leftover JS-readable session cookie and strip any legacy session
 * query params from the address bar.
 */
export function SessionClientBootstrap() {
  useEffect(() => {
    try {
      document.cookie = `${CLIENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
      sessionStorage.removeItem(CLIENT_COOKIE_NAME);
      const url = new URL(window.location.href);
      let changed = false;
      for (const key of ["__k", "__session", "t", "k"] as const) {
        if (url.searchParams.has(key)) {
          url.searchParams.delete(key);
          changed = true;
        }
      }
      if (!changed) return;
      const clean = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", clean);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}
