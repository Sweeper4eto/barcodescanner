"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { useT } from "@/components/i18n-provider";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-md flex-col justify-center px-3 py-6">
      <div className="rounded-2xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <AppLogo size={56} />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-accent">
            {t("common.appName")}
          </p>
        </div>
        <h1 className="mt-3 text-center text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 text-center text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function TextField({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-input-border bg-input px-2.5 py-2 text-base text-foreground outline-none focus:border-primary"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl bg-primary px-3 py-2 text-base font-medium text-primary-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-input-border bg-card px-3 py-2 text-base font-medium text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t("auth.loginError"));
      return;
    }

    router.push(data.user.role === "ADMIN" ? "/admin" : "/app");
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextField
        label={t("auth.username")}
        value={username}
        autoComplete="username"
        onChange={setUsername}
      />
      <TextField
        label={t("auth.password")}
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={setPassword}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <PrimaryButton type="submit" disabled={loading}>
        {loading ? t("auth.loggingIn") : t("auth.login")}
      </PrimaryButton>
      <p className="text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link className="font-medium text-accent" href="/register">
          {t("auth.register")}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t("auth.registerError"));
      return;
    }

    setSuccess(data.message);
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextField
        label={t("auth.username")}
        value={username}
        autoComplete="username"
        onChange={setUsername}
      />
      <TextField
        label={t("auth.password")}
        type="password"
        value={password}
        autoComplete="new-password"
        onChange={setPassword}
      />
      <TextField
        label={t("auth.confirmPassword")}
        type="password"
        value={confirmPassword}
        autoComplete="new-password"
        onChange={setConfirmPassword}
      />
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {success ? (
        <p className="rounded-xl bg-warning-bg p-2.5 text-sm text-warning-fg">{success}</p>
      ) : null}
      <PrimaryButton type="submit" disabled={loading}>
        {loading ? t("auth.registering") : t("auth.register")}
      </PrimaryButton>
      <p className="text-center text-sm text-muted">
        {t("auth.hasAccount")}{" "}
        <Link className="font-medium text-accent" href="/login">
          {t("auth.login")}
        </Link>
      </p>
    </form>
  );
}
