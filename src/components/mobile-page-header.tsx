"use client";

import { AppHeaderLogo } from "@/components/app-header-logo";
import { AppTopActions } from "@/components/app-top-actions";

export function MobilePageHeader({
  title,
  action,
  sticky = false,
}: {
  title: string;
  action?: React.ReactNode;
  /**
   * Pin the header to the top of the viewport while the page content
   * scrolls beneath it (used on long, scrollable card lists).
   */
  sticky?: boolean;
}) {
  return (
    <div
      className={
        sticky
          ? "sticky top-0 z-20 -mx-4 mb-4 border-b border-card-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85"
          : "mb-4"
      }
    >
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