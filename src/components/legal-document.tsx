"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronBackIcon } from "@/components/app-nav-icons";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { useMobileLocale } from "@/components/mobile-i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import type { LegalDocument } from "@/content/legal";
import {
  appButtonCancelFull,
  appButtonPrimaryFull,
  appPageTopGlowClass,
} from "@/lib/app-ui";

function LegalDocumentContent({
  documentByLocale,
  otherHref,
  otherLabelKey,
}: {
  documentByLocale: Record<"en" | "bg", LegalDocument>;
  otherHref: string;
  otherLabelKey: "legal.privacy" | "legal.terms";
}) {
  const { t } = useT();
  const { locale } = useMobileLocale();
  const router = useRouter();
  const doc = documentByLocale[locale] ?? documentByLocale.en;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <div className="relative mx-auto flex min-h-svh w-full min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
      <div aria-hidden className={appPageTopGlowClass} />

      <div className="relative z-10 mb-4 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5">
        <Link
          href="/"
          className="col-start-1 row-start-1 justify-self-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={44}
            height={44}
            className="box-border size-11 shrink-0 object-contain"
          />
        </Link>

        <Link
          href="/"
          className="col-start-2 row-start-1 min-w-0 self-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={t("common.home")}
        >
          <BrandName className="text-xl leading-none" />
        </Link>

        <div className="col-start-3 row-start-1 justify-self-end self-center">
          <LanguageSwitch />
        </div>

        <button
          type="button"
          onClick={handleBack}
          aria-label={t("common.back")}
          title={t("common.back")}
          className="col-start-1 row-start-2 inline-flex size-8 items-center justify-center justify-self-center rounded-lg border border-primary/45 text-primary transition-colors hover:border-primary hover:bg-selected"
        >
          <ChevronBackIcon className="size-4" />
        </button>
      </div>

      <div className="relative z-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {doc.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("legal.lastUpdated")}: {doc.lastUpdated}
        </p>

        <article className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
          {doc.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}

          {doc.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="text-muted">
                  {paragraph}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <div className="mt-8 space-y-4 border-t border-card-border pt-5">
          <Link
            href={otherHref}
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t(otherLabelKey)}
          </Link>

          <Link href="/contact" className={appButtonPrimaryFull}>
            {t("home.contactLink")}
          </Link>

          <Link href="/" className={appButtonCancelFull}>
            {t("support.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LegalDocumentPage({
  documentByLocale,
  otherHref,
  otherLabelKey,
}: {
  documentByLocale: Record<"en" | "bg", LegalDocument>;
  otherHref: string;
  otherLabelKey: "legal.privacy" | "legal.terms";
}) {
  return (
    <MobileI18nProvider>
      <LegalDocumentContent
        documentByLocale={documentByLocale}
        otherHref={otherHref}
        otherLabelKey={otherLabelKey}
      />
    </MobileI18nProvider>
  );
}
