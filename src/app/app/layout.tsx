import type { Metadata } from "next";
import { AppSessionProvider } from "@/components/app-session-provider";
import { AppShell } from "@/components/app-shell";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { StoreSelectionProvider } from "@/components/store-selection-provider";

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
      <AppSessionProvider>
        <StoreSelectionProvider>
          <AppShell>{children}</AppShell>
        </StoreSelectionProvider>
      </AppSessionProvider>
    </MobileI18nProvider>
  );
}
