"use client";

import { AuthShell, RegisterForm } from "@/components/auth-forms";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function RegisterPageContent() {
  const { t } = useT();

  return (
    <>
      <div className="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <LanguageSwitch />
      </div>
      <AuthShell title={t("auth.register")} subtitle={t("auth.registerSubtitle")}>
        <RegisterForm />
      </AuthShell>
    </>
  );
}

export default function RegisterPage() {
  return (
    <MobileI18nProvider>
      <RegisterPageContent />
    </MobileI18nProvider>
  );
}
