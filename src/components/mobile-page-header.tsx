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
    <div className="mb-4 flex items-start justify-between gap-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitch />
        {action}
      </div>
    </div>
  );
}
