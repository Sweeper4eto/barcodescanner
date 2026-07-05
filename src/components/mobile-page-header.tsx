"use client";

import { AppTopActions } from "@/components/app-top-actions";

export function MobilePageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold">{title}</h1>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <AppTopActions />
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
