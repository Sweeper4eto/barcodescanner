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
import { useRouter } from "next/navigation";
import { CancelButton } from "@/components/cancel-button";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { appButtonDangerFull, appFooterButtonGrid } from "@/lib/app-ui";
import {
  requestTabReselect,
  type AppNavTabId,
} from "@/lib/tab-reselect";

export type NavigationLeaveGuardCopy = {
  title: string;
  message: string;
  stayLabel: string;
  leaveLabel: string;
};

type PendingNavigation = {
  href: string;
  /** Same-tab restart after confirm (discard unsaved work, remount flow). */
  reselectTabId?: string;
};

type NavigationLeaveGuardContextValue = {
  /** Non-null while a screen asks to confirm leaving via bottom nav. */
  guard: NavigationLeaveGuardCopy | null;
  setGuard: (copy: NavigationLeaveGuardCopy | null) => void;
  /**
   * Returns true when navigation may proceed immediately.
   * Returns false when a confirm dialog was opened instead.
   */
  requestNavigate: (
    href: string,
    options?: { reselectTabId?: string },
  ) => boolean;
};

const NavigationLeaveGuardContext =
  createContext<NavigationLeaveGuardContextValue | null>(null);

function LeaveConfirmDialog({
  copy,
  onStay,
  onLeave,
}: {
  copy: NavigationLeaveGuardCopy;
  onStay: () => void;
  onLeave: () => void;
}) {
  const { offsetTop, keyboardInset } = useViewportInsets();
  const bottomNav =
    "var(--app-bottom-nav-frame) + env(safe-area-inset-bottom, 0px)";

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{
        top: offsetTop,
        bottom: `calc(${bottomNav} + ${keyboardInset}px)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="navigation-leave-title"
      onClick={onStay}
    >
      <div
        className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=10"
            alt=""
            width={112}
            height={112}
            className="size-28 object-contain"
            decoding="async"
          />
        </div>

        <h2
          id="navigation-leave-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {copy.title}
        </h2>

        <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-muted">
          {copy.message}
        </p>

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <CancelButton onClick={onStay}>{copy.stayLabel}</CancelButton>
          <button type="button" className={appButtonDangerFull} onClick={onLeave}>
            {copy.leaveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function NavigationLeaveGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [guard, setGuard] = useState<NavigationLeaveGuardCopy | null>(null);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);

  const requestNavigate = useCallback(
    (href: string, options?: { reselectTabId?: string }) => {
      if (!guard) return true;
      setPendingNav({
        href,
        reselectTabId: options?.reselectTabId,
      });
      return false;
    },
    [guard],
  );

  const value = useMemo(
    () => ({ guard, setGuard, requestNavigate }),
    [guard, requestNavigate],
  );

  return (
    <NavigationLeaveGuardContext.Provider value={value}>
      {children}
      {guard && pendingNav ? (
        <LeaveConfirmDialog
          copy={guard}
          onStay={() => setPendingNav(null)}
          onLeave={() => {
            const pending = pendingNav;
            setPendingNav(null);
            if (pending.reselectTabId) {
              router.replace(pending.href, { scroll: false });
              requestTabReselect(pending.reselectTabId as AppNavTabId);
              return;
            }
            router.push(pending.href, { scroll: false });
          }}
        />
      ) : null}
    </NavigationLeaveGuardContext.Provider>
  );
}

function useNavigationLeaveGuardContext() {
  const ctx = useContext(NavigationLeaveGuardContext);
  if (!ctx) {
    throw new Error(
      "useNavigationLeaveGuard must be used within NavigationLeaveGuardProvider",
    );
  }
  return ctx;
}

/** Call from a screen that should confirm before bottom-nav leaves. */
export function useNavigationLeaveGuard(
  active: boolean,
  copy: NavigationLeaveGuardCopy,
) {
  const { setGuard } = useNavigationLeaveGuardContext();
  const { title, message, stayLabel, leaveLabel } = copy;

  useEffect(() => {
    if (!active) {
      setGuard(null);
      return;
    }
    setGuard({ title, message, stayLabel, leaveLabel });
    return () => setGuard(null);
  }, [active, title, message, stayLabel, leaveLabel, setGuard]);
}

/** Used by AppBottomNav to intercept tab clicks when a guard is active. */
export function useNavigationLeaveRequest() {
  const { guard, requestNavigate } = useNavigationLeaveGuardContext();
  return { blocked: guard != null, requestNavigate };
}
