"use client";

import { AppLogo } from "@/components/app-logo";

export function AppHeaderLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex shrink-0 overflow-visible">
      <AppLogo size={size} />
    </span>
  );
}