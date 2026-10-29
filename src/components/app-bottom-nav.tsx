"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  AddNavIcon,
  DocumentNavIcon,
  ExpiryNavIcon,
  OrdersNavIcon,
} from "@/components/app-nav-icons";
import { CancelButton } from "@/components/cancel-button";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { useNavigationLeaveRequest } from "@/components/navigation-leave-guard";
import { useAppStoreId } from "@/components/store-selection-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { appButtonDangerFull, appFooterButtonGrid } from "@/lib/app-ui";
import {
  requestTabReselect,
  type AppNavTabId,
} from "@/lib/tab-reselect";

type Tab = {
  id: AppNavTabId;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  badge?: number;
};

type PendingStartOver = {
  tabId: AppNavTabId;
  href: string;
};

function StartOverConfirmDialog({
  onStay,
  onConfirm,
}: {
  onStay: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
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
      aria-labelledby="nav-start-over-title"
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
          id="nav-start-over-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {t("app.startOverTitle")}
        </h2>

        <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-muted">
          {t("app.startOverMessage")}
        </p>

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <CancelButton onClick={onStay}>{t("app.startOverStay")}</CancelButton>
          <button
            type="button"
            className={appButtonDangerFull}
            onClick={onConfirm}
          >
            {t("app.startOverConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const { homeUser } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const { blocked, requestNavigate } = useNavigationLeaveRequest();
  const [cartCount, setCartCount] = useState(0);
  const [pendingStartOver, setPendingStartOver] =
    useState<PendingStartOver | null>(null);

  useEffect(() => {
    if (homeUser !== true || !storeId) {
      setCartCount(0);
      return;
    }

    let cancelled = false;
    async function loadCartCount() {
      try {
        const response = await fetch(
          `/api/buy-list?storeId=${encodeURIComponent(storeId)}&limit=1`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as {
          pagination?: { total?: number };
        };
        if (!cancelled) {
          setCartCount(Math.max(0, Number(data.pagination?.total) || 0));
        }
      } catch {
        if (!cancelled) setCartCount(0);
      }
    }
    void loadCartCount();
    return () => {
      cancelled = true;
    };
  }, [homeUser, storeId, pathname]);

  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const disabled = !storeReady || !storeId;

  const tabs: Tab[] = [
    {
      id: "expiry",
      href: `/app/expiry${query}`,
      label: t("app.navExpiry"),
      icon: ExpiryNavIcon,
      match: (path) => path.startsWith("/app/expiry"),
    },
    {
      id: "add",
      href: `/app/scan${query}`,
      label: t("app.navAdd"),
      icon: AddNavIcon,
      match: (path) =>
        path.startsWith("/app/scan") || path.startsWith("/app/add-product"),
    },
  ];

  if (homeUser === true) {
    tabs.push({
      id: "orders",
      href: `/app/orders${query}`,
      label: t("app.navOrders"),
      icon: OrdersNavIcon,
      match: (path) =>
        path.startsWith("/app/orders") || path.startsWith("/app/buy-list"),
      badge: cartCount > 0 ? cartCount : undefined,
    });
  } else if (homeUser === false) {
    tabs.push({
      id: "document",
      href: `/app/add-document${query}`,
      label: t("app.navDocument"),
      icon: DocumentNavIcon,
      match: (path) => path.startsWith("/app/add-document"),
    });
  }

  function confirmStartOver() {
    if (!pendingStartOver) return;
    const { tabId, href } = pendingStartOver;
    setPendingStartOver(null);
    router.replace(href, { scroll: false });
    requestTabReselect(tabId);
  }

  return (
    <>
      <nav
        aria-label={t("app.bottomNav")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
      >
        <div className="mx-auto grid min-h-[var(--app-bottom-nav-height)] min-w-0 max-w-lg grid-cols-3 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1">
          {tabs.map((tab) => {
            const active = tab.match(pathname);
            const className = `relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-medium leading-none transition-colors ${
              disabled
                ? "pointer-events-none opacity-40"
                : active
                  ? "text-primary"
                  : "text-muted hover:text-foreground"
            }`;

            const content = (
              <>
                <span className="relative inline-flex">
                  <tab.icon className="h-5 w-5" />
                  {tab.badge != null ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-fg">
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{tab.label}</span>
              </>
            );

            if (disabled) {
              return (
                <span key={tab.id} className={className}>
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={className}
                aria-current={active ? "page" : undefined}
                prefetch
                onClick={(event) => {
                  // Re-tap active tab → ask before restarting the flow.
                  if (active) {
                    event.preventDefault();
                    setPendingStartOver({ tabId: tab.id, href: tab.href });
                    return;
                  }
                  if (!blocked) return;
                  if (requestNavigate(tab.href)) return;
                  event.preventDefault();
                }}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {pendingStartOver ? (
        <StartOverConfirmDialog
          onStay={() => setPendingStartOver(null)}
          onConfirm={confirmStartOver}
        />
      ) : null}
    </>
  );
}
