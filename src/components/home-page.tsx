"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { BrandName } from "@/components/brand-name";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { appButtonPrimary } from "@/lib/app-ui";

function LoginIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function RegisterIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}

function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LeafIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 7.2C15.5 6.5 19 3 20 2c0 0-1 7-6.5 10.5" />
      <path d="M11 20c0-4 2-7 5-9" />
    </svg>
  );
}

function ChartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
    </svg>
  );
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ScanIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" />
      <path d="M7 12h10" />
    </svg>
  );
}

function DocIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h6l4 4v14H8z" />
      <path d="M14 3v4h4M10 13h6M10 17h4" />
    </svg>
  );
}

function ListIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 7h12M8 12h12M8 17h12" />
      <circle cx="4.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TeamIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14 19a4.5 4.5 0 0 1 6.5-4" />
    </svg>
  );
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || ios;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function CapabilityRow({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 text-left">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-card-border text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

function HomePageContent() {
  const { t } = useT();

  useEffect(() => {
    // Already-installed PWAs may still open `/` from an older manifest —
    // send them into the app (middleware then sends unauthenticated users to login).
    if (!isStandaloneDisplay()) return;
    window.location.replace("/app");
  }, []);

  const features = [
    { icon: BellIcon, line1: t("home.featureRemindersLine1"), line2: t("home.featureRemindersLine2") },
    { icon: LeafIcon, line1: t("home.featureWasteLine1"), line2: t("home.featureWasteLine2") },
    { icon: ChartIcon, line1: t("home.featureMoneyLine1"), line2: t("home.featureMoneyLine2") },
    { icon: ShieldIcon, line1: t("home.featureSafeLine1"), line2: t("home.featureSafeLine2") },
  ] as const;

  const faqs = [
    { q: t("home.faqMobileQ"), a: t("home.faqMobileA") },
    { q: t("home.faqOfflineQ"), a: t("home.faqOfflineA") },
    { q: t("home.faqTeamQ"), a: t("home.faqTeamA") },
    { q: t("home.faqSupportQ"), a: t("home.faqSupportA") },
  ] as const;

  const howSteps = [
    { n: "1", title: t("home.howStep1Title"), body: t("home.howStep1Body") },
    { n: "2", title: t("home.howStep2Title"), body: t("home.howStep2Body") },
    { n: "3", title: t("home.howStep3Title"), body: t("home.howStep3Body") },
  ] as const;

  return (
    <div className="relative mx-auto flex min-h-svh min-w-0 max-w-lg flex-col px-4 pb-12 pt-[max(0.85rem,env(safe-area-inset-top,0px))] sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgb(52_211_153/0.16),transparent_60%)]"
      />

      <div className="relative z-40 flex justify-end">
        <LanguageSwitch />
      </div>

      <div className="relative z-0 mt-5 flex w-full flex-col items-center text-center">
        <div className="flex w-full min-w-0 max-w-full items-center justify-center overflow-visible px-2">
          <div className="inline-flex max-w-full items-center justify-center gap-2.5 text-[clamp(1.9rem,8.5vw,2.75rem)] leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt=""
              width={200}
              height={200}
              className="box-border h-[1.55em] w-[1.55em] shrink-0 object-contain"
              decoding="async"
            />
            <BrandName className="shrink-0 whitespace-nowrap text-[1em] leading-none" />
          </div>
        </div>

        <h1 className="mt-8 text-[1.9rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.15rem]">
          <span className="block text-foreground">{t("home.taglineLead")}</span>
          <span className="block text-primary">{t("home.taglineAccent")}</span>
        </h1>

        <p className="mt-3.5 max-w-[21rem] text-[0.92rem] leading-relaxed text-foreground/85">
          <span className="block">{t("home.descriptionLine1")}</span>
          <span className="block">{t("home.descriptionLine2")}</span>
        </p>

        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2.5">
          <Link
            href="/login"
            className={`${appButtonPrimary} h-10 gap-2 px-2.5`}
          >
            <LoginIcon className="size-5 shrink-0" />
            {t("home.login")}
          </Link>
          <Link
            href="/register"
            className={`${appButtonPrimary} h-10 gap-2 px-2.5`}
          >
            <RegisterIcon className="size-5 shrink-0 text-primary" />
            {t("home.register")}
          </Link>
        </div>

        <div className="mt-7 flex w-full max-w-md items-stretch">
          {features.map((feature, index) => (
            <div
              key={feature.line1}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-1 ${
                index < features.length - 1 ? "border-r border-card-border/70" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-1">
                <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-card-border bg-transparent text-primary">
                  <feature.icon className="size-3.5" />
                </span>
                <span className="min-w-0 text-left text-[9px] font-medium leading-[1.15] text-foreground/85 sm:text-[10px]">
                  <span className="block whitespace-nowrap">{feature.line1}</span>
                  <span className="block whitespace-nowrap">{feature.line2}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full px-1 sm:px-3">
          <div className="mx-auto w-[92%] max-w-[22rem] sm:w-[90%] sm:max-w-[24rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/preview-panel.png"
              alt={t("home.previewAlt")}
              width={920}
              height={400}
              className="block h-auto w-full rounded-2xl [filter:drop-shadow(-6px_14px_28px_rgb(52_211_153/0.28))]"
              decoding="async"
            />
          </div>
        </div>
      </div>

      <section className="relative z-0 mt-12 w-full space-y-5 text-left">
        <div className="text-center">
          <SectionTitle>{t("home.capabilitiesTitle")}</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("home.capabilitiesIntro")}
          </p>
        </div>
        <div className="space-y-4">
          <CapabilityRow
            icon={<ScanIcon className="size-4" />}
            title={t("home.capScanTitle")}
            body={t("home.capScanBody")}
          />
          <CapabilityRow
            icon={<DocIcon className="size-4" />}
            title={t("home.capDocumentTitle")}
            body={t("home.capDocumentBody")}
          />
          <CapabilityRow
            icon={<ListIcon className="size-4" />}
            title={t("home.capExpiryTitle")}
            body={t("home.capExpiryBody")}
          />
          <CapabilityRow
            icon={<BellIcon className="size-4" />}
            title={t("home.capAlertsTitle")}
            body={t("home.capAlertsBody")}
          />
          <CapabilityRow
            icon={<TeamIcon className="size-4" />}
            title={t("home.capTeamTitle")}
            body={t("home.capTeamBody")}
          />
        </div>
      </section>

      <section className="relative z-0 mt-12 w-full space-y-4">
        <div className="text-center">
          <SectionTitle>{t("home.howTitle")}</SectionTitle>
        </div>
        <ol className="space-y-3">
          {howSteps.map((step) => (
            <li key={step.n} className="flex gap-3 text-left">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary text-sm font-semibold text-primary">
                {step.n}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="relative z-0 mt-12 w-full space-y-4">
        <div className="text-center">
          <SectionTitle>{t("home.seoTitle")}</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t("home.seoBody")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                src: "/landing/shot-scan.webp",
                alt: t("home.shotScanAlt"),
              },
              {
                src: "/landing/shot-document.webp",
                alt: t("home.shotDocumentAlt"),
              },
              {
                src: "/landing/shot-expiry.webp",
                alt: t("home.shotExpiryAlt"),
              },
            ] as const
          ).map((shot) => (
            <div
              key={shot.src}
              className="overflow-hidden rounded-2xl border border-card-border bg-transparent"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.alt}
                width={720}
                height={1280}
                className="block h-auto w-full object-cover object-top"
                decoding="async"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-0 mt-12 w-full space-y-4 text-left">
        <div className="text-center">
          <SectionTitle>{t("home.whoTitle")}</SectionTitle>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("home.whoShops")}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              {t("home.whoShopsBody")}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("home.whoHome")}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              {t("home.whoHomeBody")}
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-0 mt-12 w-full space-y-3 text-left">
        <div className="text-center">
          <SectionTitle>{t("home.faqTitle")}</SectionTitle>
        </div>
        <dl className="space-y-3">
          {faqs.map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-semibold text-foreground">{item.q}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="relative z-0 mt-12 w-full space-y-4 text-center">
        <SectionTitle>{t("home.ctaTitle")}</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{t("home.ctaBody")}</p>
        <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-2.5">
          <Link href="/login" className={`${appButtonPrimary} h-10 gap-2 px-2.5`}>
            <LoginIcon className="size-5 shrink-0" />
            {t("home.login")}
          </Link>
          <Link href="/register" className={`${appButtonPrimary} h-10 gap-2 px-2.5`}>
            <RegisterIcon className="size-5 shrink-0" />
            {t("home.register")}
          </Link>
        </div>
      </section>

      <div className="relative z-0 mt-10 w-full border-t border-card-border/70 pt-6 text-center">
        <p className="text-sm text-muted">{t("home.contactCta")}</p>
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <Link
            href="/contact"
            className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t("home.contactLink")}
          </Link>
          <a
            href="tel:+359887628654"
            className="text-sm font-medium text-primary"
          >
            {t("home.contactPhone")}
          </a>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("home.termsLink")}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("home.privacyLink")}
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
