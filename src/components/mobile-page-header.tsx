"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandName } from "@/components/brand-name";
import { ChevronBackIcon } from "@/components/app-nav-icons";
import {
  AppLanguageAction,
  AppStoreSelect,
} from "@/components/app-top-actions";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import { goHeaderBack } from "@/lib/app-navigation";

function isAppHomePath(pathname: string): boolean {
  return pathname === "/app" || pathname === "/app/";
}

export function MobilePageHeader({
  title,
  action,
  sticky = false,
  className = "",
  onBack,
}: {
  title?: string;
  action?: React.ReactNode;
  /**
   * Pin only this header block (prefer wrapping the full toolbar in a sticky
   * chrome on long lists so search/filters stay visible too).
   */
  sticky?: boolean;
  className?: string;
  /** Override header ← (e.g. wizard step back vs exit subflow). */
  onBack?: () => void;
}) {
  const pathname = usePathname();
  const { storeId } = useAppStoreId();
  const { t } = useT();
  const showBack = !isAppHomePath(pathname);

  // Safe-area top on every page so the logo is not cropped under the iPhone notch.
  const safeTop =
    "pt-[max(0.75rem,env(safe-area-inset-top,0px))]";
  const base = sticky
    ? `sticky top-0 z-30 mb-4 overflow-visible border-b border-card-border bg-background/95 pb-3 ${safeTop} backdrop-blur-sm supports-[backdrop-filter]:bg-background/85`
    : `mb-4 overflow-visible ${safeTop}`;

  return (
    <div className={`${base} ${className}`.trim()}>
      {/*
        Two aligned rows:
        1) logo + wordmark | language
        2) back (under logo) | store
        Same row gap on both sides so back and store sit on one baseline.
      */}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 overflow-visible">
        <Link
          href="/app"
          className="col-start-1 row-start-1 justify-self-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={44}
            height={44}
            decoding="sync"
            fetchPriority="high"
            className="box-border size-11 shrink-0 object-contain"
          />
        </Link>

        <Link
          href="/app"
          className="col-start-2 row-start-1 min-w-0 self-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          <BrandName className="text-xl leading-none" />
        </Link>

        <div className="col-start-3 row-start-1 justify-self-end self-center">
          <AppLanguageAction />
        </div>

        {showBack ? (
          <button
            type="button"
            onClick={() =>
              onBack ? onBack() : goHeaderBack(pathname, storeId)
            }
            aria-label={t("common.back")}
            title={t("common.back")}
            className="col-start-1 row-start-2 inline-flex size-8 items-center justify-center justify-self-center rounded-lg border border-primary/45 text-primary transition-colors hover:border-primary hover:bg-selected"
          >
            <ChevronBackIcon className="size-4" />
          </button>
        ) : null}

        <div className="col-start-3 row-start-2 w-[30vw] max-w-[30vw] min-w-0 justify-self-end">
          <AppStoreSelect />
        </div>
      </div>

      {title || action ? (
        <div className="mt-2 flex items-start justify-between gap-2">
          {title ? (
            <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold text-foreground">
              {title}
            </h1>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {action ? (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Full-height page shell: pinned top chrome, scrollable card list only. */
export const listPageShellClassName =
  "mx-auto flex h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible px-4 pt-1";

export const listPageChromeClassName =
  "shrink-0 space-y-2 overflow-visible border-b border-card-border bg-background pb-2";

/** Padding keeps corner action chips (half outside cards) inside the scrollport. */
export const listPageScrollClassName =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3.5 pb-3.5 pt-3.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0";

/** Standard non-list app page wrapper (safe-area comes from MobilePageHeader). */
export const appPageClassName =
  "mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1";
