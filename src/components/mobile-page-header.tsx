"use client";

import { AppHeaderLogo } from "@/components/app-header-logo";
import { AppTopActions } from "@/components/app-top-actions";

export function MobilePageHeader({
  title,
  action,
  sticky = false,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  /**
   * Pin only this header block (prefer wrapping the full toolbar in a sticky
   * chrome on long lists so search/filters stay visible too).
   */
  sticky?: boolean;
  className?: string;
}) {
  const base = sticky
    ? "sticky top-0 z-20 -mx-4 mb-4 border-b border-card-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85"
    : "mb-4";

  return (
    <div className={`${base} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <AppHeaderLogo size={36} />
          <div className="mt-2 flex items-start justify-between gap-2">
            <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold text-foreground">
              {title}
            </h1>
            {action ? (
              <div className="flex shrink-0 items-center gap-2">{action}</div>
            ) : null}
          </div>
        </div>
        <AppTopActions />
      </div>
    </div>
  );
}

/** Full-height page shell: pinned top chrome, scrollable card list only. */
export const listPageShellClassName =
  "mx-auto flex h-[calc(100dvh-var(--app-bottom-nav-height)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col px-4 pt-3";

export const listPageChromeClassName =
  "shrink-0 space-y-2 border-b border-card-border bg-background pb-2";

/** Padding keeps corner action chips (half outside cards) inside the scrollport. */
export const listPageScrollClassName =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 pt-3 [scrollbar-width:thin]";
