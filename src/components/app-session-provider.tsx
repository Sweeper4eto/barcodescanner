"use client";

import {
  createContext,
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

export type AppSessionStore = { id: string; name: string; active: boolean };

type AppSessionUser = {
  homeUser: boolean;
  stores: AppSessionStore[];
};

type AppSessionState = {
  ready: boolean;
  user: AppSessionUser | null;
  homeUser: boolean | null;
};

const AppSessionContext = createContext<AppSessionState>({
  ready: false,
  user: null,
  homeUser: null,
});

export function useAppSession() {
  return useContext(AppSessionContext);
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppSessionState>(() => ({
    ready: false,
    user: null,
    homeUser: readCachedHomeUser(),
  }));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;

        if (!data.user) {
          setState({ ready: true, user: null, homeUser: null });
          return;
        }

        const homeUser = Boolean(data.user.homeUser);
        writeCachedHomeUser(homeUser);
        const stores: AppSessionStore[] = (data.user.stores ?? []).filter(
          (store: AppSessionStore) => store.active,
        );
        setState({
          ready: true,
          user: { homeUser, stores },
          homeUser,
        });
      } catch {
        if (!cancelled) {
          setState((current) => ({
            ready: true,
            user: current.user,
            homeUser: current.homeUser ?? false,
          }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
  );
}
