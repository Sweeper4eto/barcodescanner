"use client";

import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { t } from "@/i18n";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-4 py-12">
      <div className="rounded-2xl border border-card-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <AppLogo size={64} />
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-accent">
              {t("common.appName")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {t("home.tagline")}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-muted">{t("home.description")}</p>
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
  );
}
