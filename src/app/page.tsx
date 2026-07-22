"use client";

import Link from "next/link";
import { AppHeaderLogo } from "@/components/app-header-logo";
import { AppLogo } from "@/components/app-logo";
import { t } from "@/i18n";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-full min-w-0 max-w-lg flex-col gap-6 px-4 py-6">
      <AppHeaderLogo size={40} />
      <div className="flex flex-1 flex-col justify-center">
        <div className="rounded-2xl border border-card-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <AppLogo size={80} />
            <p className="mt-3 text-lg font-semibold tracking-wide text-accent">
              {t("common.appName")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">
              {t("home.tagline")}
            </h1>
          </div>
          <p className="mt-3 text-center text-muted">{t("home.description")}</p>
          <div className="mt-8 grid gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-fg"
            >
              {t("home.login")}
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-input-border bg-card px-4 py-3 text-center font-medium text-foreground"
            >
              {t("home.register")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
