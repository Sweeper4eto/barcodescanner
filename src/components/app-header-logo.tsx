"use client";

import { AppLogo } from "@/components/app-logo";

export function AppHeaderLogo({ size = 36 }: { size?: number }) {
  return <AppLogo size={size} />;
}