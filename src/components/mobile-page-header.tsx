"use client";

import { AppHeaderLogo } from "@/components/app-header-logo";
import { AppTopActions } from "@/components/app-top-actions";

export function MobilePageHeader({
  title,
  action,
  sticky = false,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  /**
   * Pin only this header block (prefer wrapping the full toolbar in a sticky
   * chrome on long lists so search/filters stay visible too).
   */
  sticky?: boolean;
  className?: string;
}) {
  // Safe-area top on every page so the logo is not cropped under the iPhone notch.
  const safeTop =
    "pt-[max(0.75rem,env(safe-area-inset-top,0px))]";
  const base = sticky
    ? `sticky top-0 z-30 mb-4 overflow-visible border-b border-card-border bg-background/95 pb-3 ${safeTop} backdrop-blur-sm supports-[backdrop-filter]:bg-background/85`
    : `mb-4 overflow-visible ${safeTop}`;

  return (
    <div className={`${base} ${className}`.trim()}>
      <div className="flex h-11 items-center justify-between gap-2 overflow-visible sm:gap-3">
        <div className="min-w-0 shrink overflow-visible">
          <AppHeaderLogo />
        </div>
        <div className="flex h-11 max-w-[min(100%,16rem)] shrink-0 items-center overflow-visible sm:max-w-none">
          <AppTopActions />
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
  "mx-auto flex h-[calc(100dvh-var(--app-bottom-nav-height)-env(safe-area-inset-bottom,0px))] min-h-0 w-full max-w-lg flex-col overflow-x-visible px-4 pt-1";

export const listPageChromeClassName =
  "shrink-0 space-y-2 overflow-visible border-b border-card-border bg-background pb-2";

/** Padding keeps corner action chips (half outside cards) inside the scrollport. */
export const listPageScrollClassName =
  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3.5 pb-3.5 pt-3.5 [scrollbar-width:thin]";

/** Standard non-list app page wrapper (safe-area comes from MobilePageHeader). */
export const appPageClassName =
  "mx-auto min-h-full min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1";
