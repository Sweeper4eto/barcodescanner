"use client";

import type { ReactNode } from "react";
import { AppBottomNav } from "@/components/app-bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <AppBottomNav />
    </div>
  );
}
