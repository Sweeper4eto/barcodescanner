"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId } from "@/lib/store-selection";

function ExpiryIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-6 w-6"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <circle cx="12" cy="15" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-6 w-6"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2M20 7V5a1 1 0 0 0-1-1h-2M4 17v2a1 1 0 0 0 1 1h2M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 12h10" strokeWidth="2" />
    </svg>
  );
}

type Tab = {
  id: "expiry" | "add" | "scan";
  href: string;
  label: string;
  icon: () => ReactNode;
  match: (pathname: string) => boolean;
};

export function AppBottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const [storeId, setStoreId] = useState("");

  useEffect(() => {
    function syncStoreId() {
      setStoreId(getStoredStoreId() ?? "");
    }
    syncStoreId();
    window.addEventListener("magazin:store-changed", syncStoreId);
    return () => window.removeEventListener("magazin:store-changed", syncStoreId);
  }, [pathname]);

  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const disabled = !storeId;

  const tabs: Tab[] = [
    {
      id: "expiry",
      href: `/app/expiry${query}`,
      label: t("app.navExpiry"),
      icon: ExpiryIcon,
      match: (path) => path.startsWith("/app/expiry"),
    },
    {
      id: "add",
      href: `/app/add-product${query}`,
      label: t("app.navAdd"),
      icon: AddIcon,
      match: (path) => path.startsWith("/app/add-product"),
    },
    {
      id: "scan",
      href: `/app/scan${query}`,
      label: t("app.navScan"),
      icon: ScanIcon,
      match: (path) => path.startsWith("/app/scan"),
    },
  ];

  return (
    <nav
      aria-label={t("app.bottomNav")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-card-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90"
    >
      <div className="mx-auto grid min-w-0 max-w-lg grid-cols-3 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const isScan = tab.id === "scan";
          const className = `flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors ${
            disabled
              ? "pointer-events-none opacity-40"
              : active
                ? isScan
                  ? "text-primary"
                  : "text-foreground"
                : "text-muted hover:text-foreground"
          }`;

          const content = (
            <>
              <tab.icon />
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
            <Link key={tab.id} href={tab.href} className={className} aria-current={active ? "page" : undefined}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
