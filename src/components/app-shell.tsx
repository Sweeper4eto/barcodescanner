"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAppSession } from "@/components/app-session-provider";
import { registerAppSoftNavigate } from "@/lib/app-navigation";
import { clearStoredStoreId } from "@/lib/store-selection";

/** Routes available with zero assigned locations (homepage + support). */
function isAllowedWithoutStore(pathname: string): boolean {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (pathname === "/app/contact" || pathname.startsWith("/app/contact/")) {
    return true;
  }
  return false;
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
      clearStoredStoreId();
      refreshAttempted.current = false;
      return;
    }

    if (refreshAttempted.current) {
      clearStoredStoreId();
      router.replace("/app");
      return;
    }

    refreshAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const stores = await refresh();
      if (cancelled) return;
      if (stores.length === 0) {
        clearStoredStoreId();
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

  useEffect(() => {
    registerAppSoftNavigate({
      push: (path) => {
        router.push(path);
      },
      replace: (path) => {
        router.replace(path);
      },
    });
    return () => registerAppSoftNavigate(null);
  }, [router]);

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="flex-1 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))]">
        <RequireLocationGuard>{children}</RequireLocationGuard>
      </div>
      <AppBottomNav />
    </div>
  );
}
