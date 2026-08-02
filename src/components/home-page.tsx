"use client";

import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";

function HomePageContent() {
  const { t } = useT();

  return (
    <div className="relative mx-auto flex min-h-full min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top,0px))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgb(16_185_129/0.18),transparent_70%)]"
      />

      <div className="relative flex justify-end">
        <LanguageSwitch />
      </div>

      <div className="relative mt-10 flex flex-1 flex-col items-center text-center">
        <AppLogo size={88} link={false} />
        <BrandName className="mt-4 text-2xl" />

        <h1 className="mt-6 max-w-sm text-3xl font-semibold leading-tight tracking-tight">
          <span className="text-foreground">{t("home.taglineLead")} </span>
          <span className="text-primary">{t("home.taglineAccent")}</span>
        </h1>

        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          {t("home.description")}
        </p>

        <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-fg"
          >
            {t("home.login")}
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-primary/60 bg-transparent px-4 py-3 text-center text-sm font-semibold text-primary"
          >
            {t("home.register")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <MobileI18nProvider>
      <HomePageContent />
    </MobileI18nProvider>
  );
}