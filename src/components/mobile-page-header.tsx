"use client";

import { LanguageSwitch } from "@/components/language-switch";

export function MobilePageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="min-w-0 flex-1 break-words text-2xl font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitch />
        {action}
      </div>
    </div>
  );
}
