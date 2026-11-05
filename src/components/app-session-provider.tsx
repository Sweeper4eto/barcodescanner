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
  /** Account owner vs staff — drives bulk-remove selection caps. */
  clientRole: "OWNER" | "MEMBER" | null;
  /** Owners always true; members follow the Team expiry-remove setting. */
  canRemoveExpiry: boolean;
  /** True when a prior billed month is unpaid (soft lock). */
  paymentLocked: boolean;
  /** Account opted into the new home hub UI (admin switch). */
  newUiEnabled: boolean;
  stores: AppSessionStore[];
};

type AppSessionState = {
  ready: boolean;
  user: AppSessionUser | null;
  homeUser: boolean | null;
  /** Account new-UI flag; false until /me resolves or when logged out. */
  newUiEnabled: boolean;
  /** Re-fetch /me (e.g. after admin assigns a location). Returns active stores. */
  refresh: () => Promise<AppSessionStore[]>;
};

const AppSessionContext = createContext<AppSessionState>({
  ready: false,
  user: null,
  homeUser: null,
  newUiEnabled: false,
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
    return;
  }
  // Ensure legacy + per-user keys match without emitting when already correct.
  if (stored) setStoredStoreId(stored, username);
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AppSessionState, "refresh">>({
    ready: false,
    user: null,
    // Keep null until after mount so SSR and the first client paint match.
    homeUser: null,
    newUiEnabled: false,
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
        setState({
          ready: true,
          user: null,
          homeUser: null,
          newUiEnabled: false,
        });
        // Keep selected store across logout so the last location is restored
        // on the next login (cleared only when the user has no stores).
        return [];
      }

      const username = String(data.user.username ?? "");
      const homeUser = Boolean(data.user.homeUser);
      const newUiEnabled = Boolean(data.user.newUiEnabled);
      const rawRole = data.user.clientRole;
      const clientRole: AppSessionUser["clientRole"] =
        rawRole === "OWNER" || rawRole === "MEMBER" ? rawRole : null;
      const canRemoveExpiry =
        data.user.canRemoveExpiry === undefined
          ? true
          : Boolean(data.user.canRemoveExpiry);
      const paymentLocked = Boolean(data.user.paymentLocked);
      writeCachedHomeUser(homeUser);
      const stores: AppSessionStore[] = (data.user.stores ?? []).filter(
        (store: AppSessionStore) => store.active,
      );
      setState({
        ready: true,
        user: {
          username,
          homeUser,
          clientRole,
          canRemoveExpiry,
          paymentLocked,
          newUiEnabled,
          stores,
        },
        homeUser,
        newUiEnabled,
      });
      syncSelectedStore(stores, username);
      return stores;
    } catch {
      setState((current) => ({
        ready: true,
        user: current.user,
        homeUser: current.homeUser ?? false,
        newUiEnabled: current.newUiEnabled,
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
