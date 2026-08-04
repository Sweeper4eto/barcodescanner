"use client";

import { AuthShell, LoginForm } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function LoginPageContent() {
  const { t } = useT();

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
      <AuthShell title={t("auth.loginSubtitle")} showLanguageSwitch>
        <LoginForm />
      </AuthShell>
    </div>
  );
}

export default function LoginPage() {
  return (
    <MobileI18nProvider>
      <LoginPageContent />
    </MobileI18nProvider>
  );
}