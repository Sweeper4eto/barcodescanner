"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppSession } from "@/components/app-session-provider";
import { replaceAppUrlQuiet } from "@/lib/app-navigation";
import {
  STORE_CHANGED_EVENT,
  getStoredStoreId,
  setStoredStoreId,
} from "@/lib/store-selection";

type StoreSelectionState = {
  storeId: string;
  ready: boolean;
  /** True while scan/camera (or post-confirm document) must not switch stores. */
  changeLocked: boolean;
  setStoreId: (storeId: string) => void;
  setStoreChangeLocked: (locked: boolean) => void;
};

const StoreSelectionContext = createContext<StoreSelectionState>({
  storeId: "",
  ready: false,
  changeLocked: false,
  setStoreId: () => {},
  setStoreChangeLocked: () => {},
});

function readWindowStoreId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("storeId")?.trim() ?? "";
}

function syncUrlStoreId(storeId: string) {
  if (typeof window === "undefined" || !storeId) return;
  const url = new URL(window.location.href);
  if (!url.pathname.startsWith("/app")) return;
  if (url.searchParams.get("storeId") === storeId) return;
  url.searchParams.set("storeId", storeId);
  replaceAppUrlQuiet(`${url.pathname}?${url.searchParams.toString()}`);
}

/**
 * Single source of truth for the active location across header, expiry, scan,
 * and bottom nav. Avoids per-page hook state drifting back to a stale URL.
 */
export function StoreSelectionProvider({ children }: { children: ReactNode }) {
  const { user, ready: sessionReady } = useAppSession();
  const [storeId, setStoreIdState] = useState("");
  const [ready, setReady] = useState(false);
  const [changeLocked, setChangeLockedState] = useState(false);
  const storeIdRef = useRef("");
  const changeLockedRef = useRef(false);
  const storeIdsKey = useMemo(
    () => (user?.stores ?? []).map((store) => store.id).join(","),
    [user?.stores],
  );

  const applyStoreId = useCallback(
    (nextId: string, persist: boolean) => {
      if (!nextId) return;
      storeIdRef.current = nextId;
      setStoreIdState(nextId);
      if (persist) {
        setStoredStoreId(nextId, user?.username ?? null);
      }
      syncUrlStoreId(nextId);
    },
    [user?.username],
  );

  const setStoreChangeLocked = useCallback((locked: boolean) => {
    changeLockedRef.current = locked;
    setChangeLockedState(locked);
  }, []);

  const setStoreId = useCallback(
    (nextId: string) => {
      if (changeLockedRef.current) return;
      if (!nextId || nextId === storeIdRef.current) return;
      applyStoreId(nextId, true);
    },
    [applyStoreId],
  );

  useEffect(() => {
    if (!sessionReady) return;

    const stores = user?.stores ?? [];
    const username = user?.username ?? null;

    if (stores.length === 0) {
      storeIdRef.current = "";
      setStoreIdState("");
      setReady(true);
      return;
    }

    // Keep the current pick when it is still valid (do not snap back to URL).
    if (
      storeIdRef.current &&
      stores.some((store) => store.id === storeIdRef.current)
    ) {
      syncUrlStoreId(storeIdRef.current);
      setReady(true);
      return;
    }

    const stored = getStoredStoreId(username);
    const query = readWindowStoreId();
    const validStored =
      stored && stores.some((store) => store.id === stored) ? stored : null;
    const validQuery =
      query && stores.some((store) => store.id === query) ? query : null;
    const resolved = validStored ?? validQuery ?? stores[0]!.id;

    applyStoreId(resolved, true);
    setReady(true);
  }, [sessionReady, user?.username, storeIdsKey, applyStoreId, user?.stores]);

  useEffect(() => {
    if (!sessionReady) return;

    function onStoreChanged() {
      if (changeLockedRef.current) return;
      const stores = user?.stores ?? [];
      const username = user?.username ?? null;
      const stored = getStoredStoreId(username);
      if (!stored || !stores.some((store) => store.id === stored)) return;
      if (storeIdRef.current === stored) {
        syncUrlStoreId(stored);
        return;
      }
      storeIdRef.current = stored;
      setStoreIdState(stored);
      syncUrlStoreId(stored);
    }

    /** Back/forward: trust a valid ?storeId= from history; else rewrite bar to context. */
    function onPopState() {
      const stores = user?.stores ?? [];
      const username = user?.username ?? null;
      const query = readWindowStoreId();
      if (changeLockedRef.current) {
        if (storeIdRef.current) syncUrlStoreId(storeIdRef.current);
        return;
      }
      if (query && stores.some((store) => store.id === query)) {
        if (storeIdRef.current !== query) {
          storeIdRef.current = query;
          setStoreIdState(query);
          setStoredStoreId(query, username);
        }
        return;
      }
      if (storeIdRef.current) syncUrlStoreId(storeIdRef.current);
    }

    window.addEventListener(STORE_CHANGED_EVENT, onStoreChanged);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener(STORE_CHANGED_EVENT, onStoreChanged);
      window.removeEventListener("popstate", onPopState);
    };
  }, [sessionReady, user]);

  const value = useMemo(
    () => ({
      storeId,
      ready,
      changeLocked,
      setStoreId,
      setStoreChangeLocked,
    }),
    [storeId, ready, changeLocked, setStoreId, setStoreChangeLocked],
  );

  return (
    <StoreSelectionContext.Provider value={value}>
      {children}
    </StoreSelectionContext.Provider>
  );
}

export function useAppStoreId(): { storeId: string; ready: boolean } {
  const { storeId, ready } = useContext(StoreSelectionContext);
  return { storeId, ready };
}

export function useSetAppStoreId(): (storeId: string) => void {
  return useContext(StoreSelectionContext).setStoreId;
}

export function useStoreChangeLocked(): boolean {
  return useContext(StoreSelectionContext).changeLocked;
}

/** Lock the header store picker for the lifetime of `locked === true` (clears on unmount). */
export function useLockStoreSelection(locked: boolean) {
  const { setStoreChangeLocked } = useContext(StoreSelectionContext);

  useEffect(() => {
    setStoreChangeLocked(locked);
    return () => setStoreChangeLocked(false);
  }, [locked, setStoreChangeLocked]);
}
