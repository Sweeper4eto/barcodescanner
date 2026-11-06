"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAppSession } from "@/components/app-session-provider";
import { NavigationLeaveGuardProvider } from "@/components/navigation-leave-guard";
import { PaymentLockGate } from "@/components/payment-lock-gate";
import {
  registerAppSoftNavigate,
  shouldShowAppBottomNav,
} from "@/lib/app-navigation";
import { clearStoredStoreId } from "@/lib/store-selection";
import { isPathAllowedWhenPaymentLocked } from "@/lib/payment-lock";

/** Routes available with zero assigned locations (homepage + support + billing). */
function isAllowedWithoutStore(pathname: string): boolean {
  if (pathname === "/app" || pathname === "/app/") return true;
  return isPathAllowedWhenPaymentLocked(pathname);
}

function RequireLocationGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user, refresh } = useAppSession();
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!ready || !user) return;

    if (user.stores.length > 0) {
      refreshAttempted.current = false;
      return;
    }

    if (isAllowedWithoutStore(pathname)) {
      clearStoredStoreId(user.username);
      refreshAttempted.current = false;
      return;
    }

    if (refreshAttempted.current) {
      clearStoredStoreId(user.username);
      router.replace("/app");
      return;
    }

    refreshAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const stores = await refresh();
      if (cancelled) return;
      if (stores.length === 0) {
        clearStoredStoreId(user.username);
        router.replace("/app");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user, pathname, router, refresh]);

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { newUiEnabled } = useAppSession();
  const showBottomNav = shouldShowAppBottomNav(pathname, { newUiEnabled });

  useEffect(() => {
    registerAppSoftNavigate({
      push: (path) => {
        router.push(path, { scroll: false });
      },
      replace: (path) => {
        router.replace(path, { scroll: false });
      },
    });
    return () => registerAppSoftNavigate(null);
  }, [router]);

  return (
    <NavigationLeaveGuardProvider>
      {/*
        min-h-svh + border-box so bottom-nav padding sits inside the viewport
        height. Plain pb-* on a content-sized shell made short pages scrollable
        by ~4rem and painted Android's scrollbar thumb on every /app screen.
        When the hub hides the tabs, zero the nav CSS vars so page calcs expand.
        app-no-text-select: no casual selection → no Chrome “Search Google for…”.
      */}
      <div className="app-no-text-select">
        <div
          className={
            showBottomNav
              ? "box-border min-h-svh min-w-0 max-w-[100vw] pb-[calc(var(--app-bottom-nav-frame)+env(safe-area-inset-bottom,0px))]"
              : "box-border min-h-svh min-w-0 max-w-[100vw] pb-[env(safe-area-inset-bottom,0px)] [--app-bottom-nav-frame:0px] [--app-bottom-nav-height:0px]"
          }
        >
          <PaymentLockGate>
            <RequireLocationGuard>{children}</RequireLocationGuard>
          </PaymentLockGate>
        </div>
        <AppBottomNav />
      </div>
    </NavigationLeaveGuardProvider>
  );
}
