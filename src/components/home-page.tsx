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

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  intro,
  align = "center",
}: {
  title: string;
  intro?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl text-left"}>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {title}
      </h2>
      {intro ? (
        <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

function CtaPair({
  loginLabel,
  registerLabel,
  className = "",
}: {
  loginLabel: string;
  registerLabel: string;
  className?: string;
}) {
  return (
    <div className={`grid w-full max-w-md grid-cols-2 gap-2.5 ${className}`.trim()}>
      <Link href="/login" className={`${appButtonPrimary} h-11 gap-2 px-3`}>
        <LoginIcon className="size-5 shrink-0" />
        {loginLabel}
      </Link>
      <Link href="/register" className={`${appButtonPrimary} h-11 gap-2 px-3`}>
        <RegisterIcon className="size-5 shrink-0" />
        {registerLabel}
      </Link>
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

  const highlights = [
    { icon: BellIcon, label: t("home.featureReminders") },
    { icon: LeafIcon, label: t("home.featureWaste") },
    { icon: ChartIcon, label: t("home.featureMoney") },
    { icon: ShieldIcon, label: t("home.featureSafe") },
  ] as const;

  const capabilities = [
    { icon: ScanIcon, title: t("home.capScanTitle"), body: t("home.capScanBody") },
    { icon: DocIcon, title: t("home.capDocumentTitle"), body: t("home.capDocumentBody") },
    { icon: ListIcon, title: t("home.capExpiryTitle"), body: t("home.capExpiryBody") },
    { icon: BellIcon, title: t("home.capAlertsTitle"), body: t("home.capAlertsBody") },
    { icon: TeamIcon, title: t("home.capTeamTitle"), body: t("home.capTeamBody") },
  ] as const;

  const howSteps = [
    { n: "1", title: t("home.howStep1Title"), body: t("home.howStep1Body") },
    { n: "2", title: t("home.howStep2Title"), body: t("home.howStep2Body") },
    { n: "3", title: t("home.howStep3Title"), body: t("home.howStep3Body") },
  ] as const;

  const shots = [
    { src: "/landing/shot-scan.webp", alt: t("home.shotScanAlt") },
    { src: "/landing/shot-document.webp", alt: t("home.shotDocumentAlt") },
    { src: "/landing/shot-expiry.webp", alt: t("home.shotExpiryAlt") },
  ] as const;

  const faqs = [
    { q: t("home.faqMobileQ"), a: t("home.faqMobileA") },
    { q: t("home.faqOfflineQ"), a: t("home.faqOfflineA") },
    { q: t("home.faqTeamQ"), a: t("home.faqTeamA") },
    { q: t("home.faqSupportQ"), a: t("home.faqSupportA") },
  ] as const;

  return (
    <div className="marketing-home relative min-h-svh overflow-x-hidden pb-16 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_50%_-10%,rgb(52_211_153/0.18),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-40 hidden h-80 w-80 rounded-full bg-primary/10 blur-3xl lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-[28rem] hidden h-64 w-64 rounded-full bg-primary/5 blur-3xl lg:block"
      />

      <Shell>
        <header className="relative z-40 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="hidden items-center gap-2 sm:inline-flex"
            aria-label="expire365"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/brand-mark.png?v=3"
              alt=""
              width={36}
              height={36}
              className="size-8 object-contain"
              decoding="async"
            />
            <BrandName className="text-lg leading-none" />
          </Link>
          <div className="ml-auto">
            <LanguageSwitch />
          </div>
        </header>

        {/* Hero — one composition: brand, headline, support, CTAs, product visual */}
        <section className="relative z-0 mt-8 grid items-center gap-10 md:mt-12 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-10 lg:mt-14 lg:gap-14 xl:gap-16">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <div className="inline-flex items-center justify-center gap-2.5 text-[clamp(2.1rem,7vw,3.35rem)] leading-none md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/landing/brand-mark.png?v=3"
                alt=""
                width={200}
                height={200}
                className="box-border h-[1.45em] w-[1.45em] shrink-0 object-contain"
                decoding="async"
              />
              <BrandName className="shrink-0 whitespace-nowrap text-[1em] leading-none" />
            </div>

            <p className="marketing-fade-up mt-7 hidden text-sm font-medium uppercase tracking-[0.18em] text-primary/90 md:mt-0 md:block">
              expire365
            </p>

            <h1 className="marketing-fade-up mt-4 text-[clamp(1.85rem,4.5vw,3.25rem)] font-semibold leading-[1.08] tracking-tight md:mt-3">
              <span className="block text-foreground">{t("home.taglineLead")}</span>
              <span className="block text-primary">{t("home.taglineAccent")}</span>
            </h1>

            <p className="marketing-fade-up marketing-delay-1 mt-4 max-w-md text-[0.95rem] leading-relaxed text-foreground/85 md:max-w-lg md:text-base">
              {t("home.description")}
            </p>

            <CtaPair
              loginLabel={t("home.login")}
              registerLabel={t("home.register")}
              className="marketing-fade-up marketing-delay-2 mt-7 md:max-w-sm"
            />

            <ul className="marketing-fade-up marketing-delay-3 mt-8 grid w-full max-w-md grid-cols-2 gap-x-4 gap-y-3 sm:max-w-lg md:max-w-none">
              {highlights.map((item) => (
                <li
                  key={item.label}
                  className="inline-flex items-center gap-2.5 text-sm text-foreground/80"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-card-border text-primary">
                    <item.icon className="size-3.5" />
                  </span>
                  <span className="font-medium leading-snug">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="marketing-fade-up marketing-delay-2 relative mx-auto w-full max-w-md md:max-w-none">
            <div
              aria-hidden
              className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_50%_40%,rgb(52_211_153/0.22),transparent_65%)] blur-xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/preview-panel.png"
              alt={t("home.previewAlt")}
              width={920}
              height={400}
              className="block h-auto w-full rounded-2xl [filter:drop-shadow(-8px_18px_36px_rgb(52_211_153/0.28))] lg:rounded-3xl"
              decoding="async"
            />
          </div>
        </section>

        {/* Capabilities — responsive grid, not a phone list */}
        <section className="relative z-0 mt-20 md:mt-28">
          <SectionHeading
            title={t("home.capabilitiesTitle")}
            intro={t("home.capabilitiesIntro")}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-2xl border border-card-border/80 bg-foreground/[0.02] p-5 transition-colors hover:border-primary/35 hover:bg-primary/[0.04] sm:p-6"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-card-border text-primary">
                  <cap.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {cap.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {cap.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — horizontal on desktop */}
        <section className="relative z-0 mt-20 md:mt-28">
          <SectionHeading title={t("home.howTitle")} />
          <ol className="mx-auto mt-10 grid max-w-4xl gap-10 md:grid-cols-3 md:gap-8">
            {howSteps.map((step) => (
              <li
                key={step.n}
                className="flex flex-col items-center text-center"
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-primary text-sm font-semibold text-primary">
                  {step.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-[15rem] text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Product visual + copy */}
        <section className="relative z-0 mt-20 md:mt-28">
          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-10 lg:gap-14">
            <div>
              <SectionHeading
                title={t("home.seoTitle")}
                intro={t("home.seoBody")}
                align="left"
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("home.whoShops")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {t("home.whoShopsBody")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("home.whoHome")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {t("home.whoHomeBody")}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
              {shots.map((shot, i) => (
                <div
                  key={shot.src}
                  className={`overflow-hidden rounded-2xl border border-card-border bg-black/20 shadow-[0_20px_50px_-28px_rgb(52_211_153/0.45)] ${
                    i === 1 ? "mt-6 sm:mt-10" : i === 2 ? "mt-3 sm:mt-5" : ""
                  }`}
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
          </div>
        </section>

        {/* FAQ */}
        <section className="relative z-0 mt-20 md:mt-28">
          <SectionHeading title={t("home.faqTitle")} />
          <dl className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-card-border/80 px-5 py-4 sm:px-6 sm:py-5"
              >
                <dt className="text-sm font-semibold text-foreground md:text-base">
                  {item.q}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Bottom CTA */}
        <section className="relative z-0 mt-20 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-transparent px-6 py-12 text-center md:mt-28 md:px-12 md:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {t("home.ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted md:text-base">
            {t("home.ctaBody")}
          </p>
          <CtaPair
            loginLabel={t("home.login")}
            registerLabel={t("home.register")}
            className="mx-auto mt-8"
          />
        </section>

        <footer className="relative z-0 mt-14 border-t border-card-border/70 pt-8 text-center">
          <p className="text-sm text-muted">{t("home.contactCta")}</p>
          <div className="mt-2 flex flex-col items-center gap-1.5 sm:flex-row sm:justify-center sm:gap-4">
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted">
            <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("home.termsLink")}
            </Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
              {t("home.privacyLink")}
            </Link>
          </div>
        </footer>
      </Shell>
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
