"use client";

import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  AddNavIcon,
  DocumentNavIcon,
  ExpiryNavIcon,
  OrdersNavIcon,
} from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId } from "@/lib/store-selection";

type Tab = {
  id: "expiry" | "add" | "document" | "orders";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  match: (pathname: string) => boolean;
  emphasize?: boolean;
};

export function AppBottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const [storeId, setStoreId] = useState("");
  const [homeUser, setHomeUser] = useState<boolean | null>(null);

  useEffect(() => {
    function syncStoreId() {
      setStoreId(getStoredStoreId() ?? "");
    }
    syncStoreId();
    window.addEventListener("magazin:store-changed", syncStoreId);
    return () => window.removeEventListener("magazin:store-changed", syncStoreId);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function loadHomeUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (cancelled) return;
        setHomeUser(Boolean(data.user?.homeUser));
      } catch {
        if (!cancelled) setHomeUser(false);
      }
    }
    void loadHomeUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const disabled = !storeId;

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
      emphasize: true,
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
      emphasize: true,
      match: (path) =>
        path.startsWith("/app/orders") || path.startsWith("/app/buy-list"),
    });
  } else if (homeUser === false) {
    tabs.push({
      id: "document",
      href: `/app/add-document${query}`,
      label: t("app.navDocument"),
      icon: DocumentNavIcon,
      emphasize: true,
      match: (path) => path.startsWith("/app/add-document"),
    });
  }

  const gridCols = homeUser === null ? "grid-cols-2" : "grid-cols-3";

  return (
    <nav
      aria-label={t("app.bottomNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90"
    >
      <div
        className={`mx-auto grid min-h-[var(--app-bottom-nav-height)] min-w-0 max-w-lg ${gridCols} px-1 pb-[max(0.125rem,env(safe-area-inset-bottom))]`}
      >
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const className = `flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium leading-none transition-colors ${
            disabled
              ? "pointer-events-none opacity-40"
              : active
                ? tab.emphasize
                  ? "text-primary"
                  : "text-foreground"
                : "text-muted hover:text-foreground"
          }`;

          const content = (
            <>
              <tab.icon className="h-5 w-5" />
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
            <a
              key={tab.id}
              href={tab.href}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </a>
          );
        })}
      </div>
    </nav>
  );
}