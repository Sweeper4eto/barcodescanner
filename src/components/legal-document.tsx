"use client";

import Link from "next/link";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { useMobileLocale } from "@/components/mobile-i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import type { LegalDocument } from "@/content/legal";

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
  const doc = documentByLocale[locale] ?? documentByLocale.en;

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-lg flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/brand-mark.png?v=3"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 object-contain"
          />
          <BrandName className="text-lg" />
        </Link>
        <LanguageSwitch />
      </div>

      <h1 className="text-2xl font-semibold text-foreground">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {t("legal.lastUpdated")}: {doc.lastUpdated}
      </p>

      <article className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90">
        {doc.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}

        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-foreground/85">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>

      <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-card-border/70 pt-5 text-sm">
        <Link href={otherHref} className="font-medium text-primary underline-offset-4 hover:underline">
          {t(otherLabelKey)}
        </Link>
        <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("home.contactLink")}
        </Link>
        <Link href="/" className="text-muted underline-offset-4 hover:underline">
          {t("common.back")}
        </Link>
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