"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { expiryUrgencyClass } from "@/lib/expiry";

const PAGE_SIZE = 20;

type Entry = {
  id: string;
  barcode: string;
  quantity: number;
  enteredAt: string;
  expiryDate: string;
  product: { name: string; imagePath: string | null };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function ExpiryList() {
  const { t, dateLocale } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showScanner, setShowScanner] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadEntries = useCallback(
    async (targetPage = page) => {
      if (!storeId) return;

      setLoading(true);
      const params = new URLSearchParams({ storeId });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      } else {
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_SIZE));
      }

      const response = await fetch(`/api/inventory?${params.toString()}`);
      const data = (await response.json()) as {
        entries?: Entry[];
        pagination?: Pagination;
      };

      setEntries(data.entries ?? []);
      setPagination(
        data.pagination ?? {
          page: targetPage,
          limit: PAGE_SIZE,
          total: data.entries?.length ?? 0,
          totalPages: 1,
        },
      );
      setLoading(false);
    },
    [storeId, debouncedSearch, page],
  );

  useEffect(() => {
    if (storeId) {
      void loadEntries(page);
    }
  }, [storeId, debouncedSearch, page, loadEntries]);

  async function removeEntry(entryId: string) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, storeId }),
    });
    setConfirmId(null);
    await loadEntries(page);
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("expiry.noResults") : t("expiry.empty");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <MobilePageHeader
        title={t("expiry.title")}
        action={
          <Link href="/app" className="text-sm text-accent">
            {t("common.back")}
          </Link>
        }
      />

      <div className="mb-4 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          placeholder={t("expiry.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowScanner((open) => !open)}
          className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-medium ${
            showScanner
              ? "border-primary bg-selected text-foreground"
              : "border-input-border bg-card text-foreground"
          }`}
        >
          {t("expiry.scan")}
        </button>
      </div>

      {search ? (
        <button
          type="button"
          className="mb-4 text-sm text-accent"
          onClick={() => {
            setSearch("");
            setShowScanner(false);
          }}
        >
          {t("expiry.clearSearch")}
        </button>
      ) : null}

      {showScanner ? (
        <div className="mb-4 rounded-2xl border border-card-border p-4">
          <BarcodeScanner
            onScan={async (barcode) => onBarcodeScanned(barcode)}
            onCancel={() => setShowScanner(false)}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {t("expiry.loading")}
          </p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {!loading
          ? entries.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-2xl border p-4 ${expiryUrgencyClass(new Date(entry.expiryDate))}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.product.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {t("common.barcode")}: {entry.barcode}
                    </p>
                    <p className="text-sm text-muted">
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
            ))
          : null}
      </div>

      {!loading && !isSearching && pagination.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-xl border border-input-border bg-card px-4 py-3 text-sm font-medium text-foreground disabled:opacity-50"
          >
            {t("expiry.previous")}
          </button>
          <p className="text-sm text-muted">
            {t("expiry.pageOf", {
              page: pagination.page,
              totalPages: pagination.totalPages,
            })}
          </p>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() =>
              setPage((current) => Math.min(pagination.totalPages, current + 1))
            }
            className="rounded-xl border border-input-border bg-card px-4 py-3 text-sm font-medium text-foreground disabled:opacity-50"
          >
            {t("expiry.next")}
          </button>
        </div>
      ) : null}

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
                onClick={() => void removeEntry(confirmId)}
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
