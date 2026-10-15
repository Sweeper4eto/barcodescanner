"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readCachedHomeUser,
  writeCachedHomeUser,
} from "@/lib/home-user-cache";
import {
  clearStoredStoreId,
  getStoredStoreId,
  setStoredStoreId,
} from "@/lib/store-selection";

export type AppSessionStore = { id: string; name: string; active: boolean };

type AppSessionUser = {
  username: string;
  homeUser: boolean;
  stores: AppSessionStore[];
};

type AppSessionState = {
  ready: boolean;
  user: AppSessionUser | null;
  homeUser: boolean | null;
  /** Re-fetch /me (e.g. after admin assigns a location). Returns active stores. */
  refresh: () => Promise<AppSessionStore[]>;
};

const AppSessionContext = createContext<AppSessionState>({
  ready: false,
  user: null,
  homeUser: null,
  refresh: async () => [],
});

export function useAppSession() {
  return useContext(AppSessionContext);
}

function syncSelectedStore(stores: AppSessionStore[], username: string) {
  if (stores.length === 0) {
    clearStoredStoreId(username);
    return;
  }
  const stored = getStoredStoreId(username);
  const valid = stores.some((store) => store.id === stored);
  if (!valid) {
    setStoredStoreId(stores[0]!.id, username);
  } else if (stored) {
    // Re-write so both legacy + per-user keys stay aligned after login.
    setStoredStoreId(stored, username);
  }
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AppSessionState, "refresh">>({
    ready: false,
    user: null,
    // Keep null until after mount so SSR and the first client paint match.
    homeUser: null,
  });

  const refresh = useCallback(async (): Promise<AppSessionStore[]> => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
        // Phone/LAN: never leave the header store chip on a skeleton forever.
        signal: AbortSignal.timeout(12_000),
      });
      const data = await response.json();

      if (!data.user) {
        setState({ ready: true, user: null, homeUser: null });
        // Keep selected store across logout so the last location is restored
        // on the next login (cleared only when the user has no stores).
        return [];
      }

      const username = String(data.user.username ?? "");
      const homeUser = Boolean(data.user.homeUser);
      writeCachedHomeUser(homeUser);
      const stores: AppSessionStore[] = (data.user.stores ?? []).filter(
        (store: AppSessionStore) => store.active,
      );
      setState({
        ready: true,
        user: { username, homeUser, stores },
        homeUser,
      });
      syncSelectedStore(stores, username);
      return stores;
    } catch {
      setState((current) => ({
        ready: true,
        user: current.user,
        homeUser: current.homeUser ?? false,
      }));
      return [];
    }
  }, []);

  useEffect(() => {
    const cached = readCachedHomeUser();
    if (cached !== null) {
      setState((current) =>
        current.homeUser === null
          ? { ...current, homeUser: cached }
          : current,
      );
    }

    void refresh();

    function onFocus() {
      void refresh();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") void refresh();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ ...state, refresh }),
    [state, refresh],
  );

  return (
    <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
  );
}
