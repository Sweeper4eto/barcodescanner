"use client";

import { AppHeaderLogo } from "@/components/app-header-logo";
import { AppTopActions } from "@/components/app-top-actions";

export function MobilePageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <AppHeaderLogo size={36} />
        <AppTopActions />
      </div>
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold">{title}</h1>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
