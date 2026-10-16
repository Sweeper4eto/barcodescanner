"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppSession } from "@/components/app-session-provider";
import { replaceApp } from "@/lib/app-navigation";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

function syncUrlStoreId(storeId: string, syncedRef: { current: string | null }) {
  if (typeof window === "undefined" || !storeId) return;
  const url = new URL(window.location.href);
  if (!url.pathname.startsWith("/app")) return;
  if (url.searchParams.get("storeId") === storeId) {
    syncedRef.current = storeId;
    return;
  }
  if (syncedRef.current === storeId) return;
  syncedRef.current = storeId;
  url.searchParams.set("storeId", storeId);
  replaceApp(`${url.pathname}?${url.searchParams.toString()}`);
}

/**
 * Resolve the active store for /app pages from the URL, localStorage, or the
 * signed-in user's store list — and keep the URL in sync when possible.
 *
 * After the header picker changes location, localStorage wins until the URL
 * catches up — otherwise a stale `?storeId=` can overwrite the new choice and
 * leave expiry/buy-list on the previous store.
 */
export function useAppStoreId(): { storeId: string; ready: boolean } {
  const searchParams = useSearchParams();
  const queryStoreId = searchParams.get("storeId")?.trim() ?? "";
  const { user, ready: sessionReady } = useAppSession();
  const [storeId, setStoreId] = useState(queryStoreId);
  const [ready, setReady] = useState(() => Boolean(queryStoreId));
  const urlSyncedForRef = useRef<string | null>(
    queryStoreId ? queryStoreId : null,
  );
  /** Prefer storage over URL until soft navigation applies the picked store. */
  const preferStoredRef = useRef(false);

  useEffect(() => {
    if (!sessionReady) {
      if (queryStoreId) {
        setStoreId(queryStoreId);
        setStoredStoreId(queryStoreId);
        urlSyncedForRef.current = queryStoreId;
        setReady(true);
      }
      return;
    }

    const stores = user?.stores ?? [];
    const username = user?.username ?? null;
    const stored = getStoredStoreId(username);
    const validStored =
      Boolean(stored) && stores.some((store) => store.id === stored);
    const validQuery =
      Boolean(queryStoreId) && stores.some((store) => store.id === queryStoreId);

    // Picker / storage just changed — do not let a lagging URL reset the store.
    if (preferStoredRef.current && validStored && stored) {
      setStoreId(stored);
      setReady(true);
      if (queryStoreId === stored) {
        preferStoredRef.current = false;
        urlSyncedForRef.current = stored;
      } else {
        syncUrlStoreId(stored, urlSyncedForRef);
      }
      return;
    }

    if (validQuery) {
      preferStoredRef.current = false;
      setStoreId(queryStoreId);
      setStoredStoreId(queryStoreId, username);
      urlSyncedForRef.current = queryStoreId;
      setReady(true);
      return;
    }

    const resolved = validStored && stored ? stored : (stores[0]?.id ?? "");

    setStoreId(resolved);
    setReady(true);

    if (!resolved) return;

    setStoredStoreId(resolved, username);
    syncUrlStoreId(resolved, urlSyncedForRef);
  }, [sessionReady, user, queryStoreId]);

  useEffect(() => {
    if (!sessionReady) return;

    function onStoreChanged() {
      const stores = user?.stores ?? [];
      const username = user?.username ?? null;
      const stored = getStoredStoreId(username);
      if (!stored || !stores.some((store) => store.id === stored)) return;

      preferStoredRef.current = true;
      setStoreId(stored);
      setReady(true);
      syncUrlStoreId(stored, urlSyncedForRef);
    }

    window.addEventListener("magazin:store-changed", onStoreChanged);
    return () =>
      window.removeEventListener("magazin:store-changed", onStoreChanged);
  }, [sessionReady, user]);

  return { storeId, ready };
}
