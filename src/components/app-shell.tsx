"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { registerAppSoftNavigate } from "@/lib/app-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    registerAppSoftNavigate({
      push: (path) => {
        router.push(path);
      },
      replace: (path) => {
        router.replace(path);
      },
    });
    return () => registerAppSoftNavigate(null);
  }, [router]);

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <div className="flex-1 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <AppBottomNav />
    </div>
  );
}
