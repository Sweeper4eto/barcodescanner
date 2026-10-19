"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type AppChromeValue = {
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
};

const AppChromeContext = createContext<AppChromeValue | null>(null);

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const value = useMemo(
    () => ({ hideBottomNav, setHideBottomNav }),
    [hideBottomNav],
  );
  return (
    <AppChromeContext.Provider value={value}>
      {children}
    </AppChromeContext.Provider>
  );
}

export function useAppChrome(): AppChromeValue {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error("useAppChrome requires AppChromeProvider");
  }
  return ctx;
}

/**
 * Hide the fixed app bottom nav while `active` is true.
 * On release / unmount, restore is deferred so Cancel → soft-navigate does not
 * flash the nav (and shell padding) under the outgoing camera page.
 */
export function useHideAppBottomNav(active: boolean) {
  const { setHideBottomNav } = useAppChrome();
  const hideGenerationRef = useRef(0);

  useEffect(() => {
    if (active) {
      const generation = ++hideGenerationRef.current;
      setHideBottomNav(true);
      return () => {
        window.setTimeout(() => {
          if (hideGenerationRef.current === generation) {
            setHideBottomNav(false);
          }
        }, 150);
      };
    }
    hideGenerationRef.current += 1;
    setHideBottomNav(false);
    return undefined;
  }, [active, setHideBottomNav]);
}

/**
 * Extra bottom inset (px) when mobile browser chrome (Safari address/toolbar)
 * overlaps the layout viewport. `safe-area-inset-bottom` alone does not cover this.
 */
export function useVisualViewportBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const overlap = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      setInset(overlap);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return inset;
}
