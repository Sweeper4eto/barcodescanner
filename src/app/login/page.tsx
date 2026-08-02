"use client";

import Link from "next/link";
import { AuthShell, LoginForm } from "@/components/auth-forms";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function LoginPageContent() {
  const { t } = useT();

  return (
    <>
      <div className="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <LanguageSwitch />
      </div>
      <AuthShell title={t("auth.login")} subtitle={t("auth.loginSubtitle")}>
        <LoginForm />
      </AuthShell>
    </>
  );
}

export default function LoginPage() {
  return (
    <MobileI18nProvider>
      <LoginPageContent />
    </MobileI18nProvider>
  );
}
