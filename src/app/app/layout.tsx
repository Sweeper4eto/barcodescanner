import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileI18nProvider>
      <AppShell>{children}</AppShell>
    </MobileI18nProvider>
  );
}
