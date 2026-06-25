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
      <div className="flex justify-end px-4 pt-4">
        <LanguageSwitch />
      </div>
      <AuthShell title={t("auth.login")} subtitle={t("auth.loginSubtitle")}>
        <LoginForm />
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-muted">
            {t("common.home")}
          </Link>
        </div>
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
