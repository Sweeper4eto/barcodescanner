"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { MenuSelect } from "@/components/menu-select";
import { useT } from "@/components/i18n-provider";
import { navigateApp } from "@/lib/app-navigation";
import { getStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

type Topic = "bug" | "ocr" | "billing" | "other";

const MESSAGE_MAX = 2000;

function BugIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 9V7a4 4 0 0 1 8 0v2" strokeLinecap="round" />
      <rect x="7" y="9" width="10" height="10" rx="3" />
      <path d="M7 13H4M20 13h-3M9 17H6M18 17h-3M12 9v10" strokeLinecap="round" />
    </svg>
  );
}

function OcrIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" strokeLinecap="round" />
      <path d="M8 12h8M8 9h5M8 15h5" strokeLinecap="round" />
    </svg>
  );
}

function BillingIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" strokeLinecap="round" />
      <path d="M7 15h3" strokeLinecap="round" />
    </svg>
  );
}

function OtherIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="6.5" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function MailIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 16.5 4 21l4.5-1.5A8.5 8.5 0 1 0 5 16.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden>
      <path d="M4 11.5 20 4l-4.5 16-3.2-6.3L4 11.5Z" strokeLinejoin="round" />
      <path d="M12.3 13.7 20 4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3 5 6.5v5.2c0 4.2 2.8 7.4 7 8.8 4.2-1.4 7-4.6 7-8.8V6.5L12 3Z" strokeLinejoin="round" />
      <path d="m9.5 12 1.8 1.8 3.7-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TopicButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-xl border px-1 py-1.5 text-[0.7rem] font-semibold leading-none transition-colors ${
        active
          ? "border-primary bg-selected text-primary"
          : "border-card-border bg-transparent text-muted hover:border-primary/40 hover:text-foreground"
      }`}
    >
      <span aria-hidden className="inline-flex shrink-0 [&_svg]:size-5">
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function ContactSupportPage() {
  const { t } = useT();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [topic, setTopic] = useState<Topic>("bug");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/auth/me");
      const data = await response.json().catch(() => null);
      if (cancelled) return;
      const list: Store[] = (data?.user?.stores ?? []).filter((s: Store) => s.active);
      setStores(list);
      const preferred = getStoredStoreId();
      const next = list.find((s) => s.id === preferred)?.id ?? list[0]?.id ?? "";
      setStoreId(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function send() {
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          storeId: storeId || null,
          contact: contact.trim() || null,
          message: message.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setSent(true);
      setTicketId(String(data?.ticketId ?? ""));
      setMessage("");
      setContact("");
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setSending(false);
    }
  }

  const topics: { id: Topic; label: string; icon: ReactNode }[] = [
    { id: "bug", label: t("support.topicBugShort"), icon: <BugIcon /> },
    { id: "ocr", label: t("support.topicOcrShort"), icon: <OcrIcon /> },
    { id: "billing", label: t("support.topicBillingShort"), icon: <BillingIcon /> },
    { id: "other", label: t("support.topicOtherShort"), icon: <OtherIcon /> },
  ];

  return (
    <div className="relative mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-4 pt-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.18),transparent_55%)]"
      />

      <div className="relative z-40">
        <MobilePageHeader className="mb-3" />
      </div>

      <div className="relative z-0 mb-3 flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-foreground">
          {t("support.title")}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/brand-mark.png?v=3"
          alt=""
          width={88}
          height={88}
          className="h-20 w-20 shrink-0 object-contain drop-shadow-[0_0_24px_rgb(52_211_153/0.4)]"
          decoding="async"
        />
      </div>

      <div className="relative z-0 space-y-2.5 rounded-2xl border border-card-border bg-card p-3">
        <div>
          <p className="mb-1 text-sm font-medium text-foreground">{t("support.topic")}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {topics.map((item) => (
              <TopicButton
                key={item.id}
                active={topic === item.id}
                label={item.label}
                icon={item.icon}
                onClick={() => setTopic(item.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-foreground">{t("support.store")}</p>
          <MenuSelect
            label={t("support.store")}
            value={storeId}
            options={
              stores.length === 0
                ? [{ value: "", label: t("support.noStores") }]
                : stores.map((store) => ({
                    value: store.id,
                    label: store.name,
                  }))
            }
            onChange={setStoreId}
            disabled={stores.length === 0}
            placeholder={t("support.storePlaceholder")}
            leadingIcon={<PinIcon className="size-4" />}
            buttonClassName="flex w-full min-w-0 items-center gap-2 rounded-xl border border-input-border bg-transparent py-2 pl-3 pr-3 text-left text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          />
        </div>

        <label className="block text-sm font-medium text-foreground">
          {t("support.contact")}
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <MailIcon className="size-4" />
            </span>
            <input
              className="w-full rounded-xl border border-input-border bg-input py-2 pl-10 pr-3 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
              value={contact}
              placeholder={t("support.contactPlaceholder")}
              onChange={(event) => setContact(event.target.value)}
            />
          </span>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t("support.message")}
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute left-3 top-2.5 text-muted">
              <ChatIcon className="size-4" />
            </span>
            <textarea
              className="min-h-24 w-full resize-y rounded-xl border border-input-border bg-input py-2 pl-10 pr-3 pb-7 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
              value={message}
              maxLength={MESSAGE_MAX}
              placeholder={t("support.messagePlaceholder")}
              onChange={(event) => setMessage(event.target.value)}
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[0.7rem] text-muted">
              {message.length}/{MESSAGE_MAX}
            </span>
          </span>
        </label>

        {sent ? (
          <p className="text-sm text-success-fg">
            {t("support.sent")}
            {ticketId ? ` #${ticketId.slice(0, 8)}` : ""}
          </p>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <PrimaryButton onClick={send} disabled={sending || !message.trim()}>
          <span className="inline-flex items-center justify-center gap-2">
            <SendIcon className="size-4" />
            {sending ? t("support.sending") : t("support.send")}
          </span>
        </PrimaryButton>

        <p className="flex items-start justify-center gap-1.5 text-center text-[0.7rem] leading-snug text-muted">
          <ShieldIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{t("support.secureNote")}</span>
        </p>

        <SecondaryButton onClick={() => navigateApp("/app")}>
          {t("common.back")}
        </SecondaryButton>
      </div>
    </div>
  );
}
