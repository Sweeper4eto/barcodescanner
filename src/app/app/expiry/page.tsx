"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { expiryUrgencyClass } from "@/lib/expiry";

type Entry = {
  id: string;
  quantity: number;
  enteredAt: string;
  expiryDate: string;
  product: { name: string; imagePath: string | null };
};

function ExpiryList() {
  const { t, dateLocale } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function reloadEntries() {
    const response = await fetch(`/api/inventory?storeId=${storeId}`);
    const data = await response.json();
    setEntries(data.entries ?? []);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      const response = await fetch(`/api/inventory?storeId=${storeId}`);
      const data = await response.json();
      if (!cancelled) {
        setEntries(data.entries ?? []);
      }
    }

    if (storeId) {
      void loadEntries();
    }

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function removeEntry(entryId: string) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, storeId }),
    });
    setConfirmId(null);
    await reloadEntries();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("expiry.title")}</h1>
        <Link href="/app" className="text-sm text-accent">
          {t("common.back")}
        </Link>
      </div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {t("expiry.empty")}
          </p>
        ) : null}

        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`rounded-2xl border p-4 ${expiryUrgencyClass(new Date(entry.expiryDate))}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{entry.product.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {t("common.quantity")}: {entry.quantity}
                </p>
                <p className="text-sm text-muted">
                  {t("expiry.entered")}:{" "}
                  {new Date(entry.enteredAt).toLocaleDateString(dateLocale)}
                </p>
                <p className="text-sm text-muted">
                  {t("expiry.expiryDate")}:{" "}
                  {new Date(entry.expiryDate).toLocaleDateString(dateLocale)}
                </p>
              </div>
              <button
                className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                onClick={() => setConfirmId(entry.id)}
              >
                {t("expiry.remove")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmId ? (
        <div className="fixed inset-0 flex items-end bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-card p-4">
            <p className="font-medium">{t("expiry.confirmTitle")}</p>
            <p className="mt-2 text-sm text-muted">{t("expiry.confirmMessage")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="rounded-xl border border-input-border bg-card px-4 py-3 text-foreground"
                onClick={() => setConfirmId(null)}
              >
                {t("expiry.confirmCancel")}
              </button>
              <button
                className="rounded-xl bg-danger px-4 py-3 text-danger-fg"
                onClick={() => removeEntry(confirmId)}
              >
                {t("expiry.remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ExpiryPage() {
  return (
    <Suspense>
      <ExpiryList />
    </Suspense>
  );
}
