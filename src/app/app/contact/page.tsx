"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { navigateApp } from "@/lib/app-navigation";
import { getStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

type Topic = "bug" | "ocr" | "billing" | "other";

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

  return (
    <div className="mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-6 pt-1">
      <MobilePageHeader title={t("support.title")} />
      <p className="mb-4 text-sm text-muted">{t("support.subtitle")}</p>

      <div className="space-y-3 rounded-2xl border border-card-border bg-card p-4">
        <label className="block text-sm font-medium text-foreground">
          {t("support.topic")}
          <select
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={topic}
            onChange={(event) => setTopic(event.target.value as Topic)}
          >
            <option value="bug">{t("support.topicBug")}</option>
            <option value="ocr">{t("support.topicOcr")}</option>
            <option value="billing">{t("support.topicBilling")}</option>
            <option value="other">{t("support.topicOther")}</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t("support.store")}
          <select
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            disabled={stores.length === 0}
          >
            {stores.length === 0 ? (
              <option value="">{t("support.noStores")}</option>
            ) : null}
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t("support.contact")}
          <input
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          {t("support.message")}
          <textarea
            className="mt-1 min-h-28 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-base text-foreground"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("support.messagePlaceholder")}
          />
        </label>

        {sent ? (
          <p className="text-sm text-success-fg">
            {t("support.sent")}
            {ticketId ? ` #${ticketId.slice(0, 8)}` : ""}
          </p>
        ) : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={send} disabled={sending || !message.trim()}>
            {sending ? t("support.sending") : t("support.send")}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigateApp("/app")}>
            {t("common.back")}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

