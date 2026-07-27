"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthShell,
  PrimaryButton,
  TextField,
} from "@/components/auth-forms";
import { AppHeaderLogo } from "@/components/app-header-logo";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function ChangePasswordContent() {
  const router = useRouter();
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const nextPassword = String(formData.get("password") ?? password);
    const nextConfirm = String(
      formData.get("confirmPassword") ?? confirmPassword,
    );
    setPassword(nextPassword);
    setConfirmPassword(nextConfirm);

    if (nextPassword !== nextConfirm) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: nextPassword,
        confirmPassword: nextConfirm,
      }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? t("auth.passwordChangeError"));
      return;
    }

    router.push(data?.user?.role === "ADMIN" ? "/admin" : "/app");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
        <AppHeaderLogo size={36} />
        <LanguageSwitch />
      </div>
      <AuthShell
        title={t("auth.changePasswordTitle")}
        subtitle={t("auth.changePasswordSubtitle")}
      >
        <form className="space-y-3" onSubmit={onSubmit}>
          <TextField
            label={t("auth.newPassword")}
            name="password"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={setPassword}
          />
          <TextField
            label={t("auth.confirmPassword")}
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={setConfirmPassword}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? t("auth.changingPassword") : t("auth.changePassword")}
          </PrimaryButton>
        </form>
      </AuthShell>
    </>
  );
}

export default function ChangePasswordPage() {
  return (
    <MobileI18nProvider>
      <ChangePasswordContent />
    </MobileI18nProvider>
  );
}
