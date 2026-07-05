"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon } from "@/components/app-nav-icons";
import { ExpiryListCard } from "@/components/expiry-list-card";
import { ExpiryPeriodFilter } from "@/components/expiry-period-filter";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import {
  type ExpiryPeriod,
  DEFAULT_EXPIRY_PERIOD,
  expiryPeriodToApiParam,
  getStoredExpiryPeriod,
  setStoredExpiryPeriod,
} from "@/lib/expiry-period";

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
  const { t } = useT();
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
  const [period, setPeriod] = useState<ExpiryPeriod>(DEFAULT_EXPIRY_PERIOD);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setPeriod(getStoredExpiryPeriod());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setEntries([]);
  }, [debouncedSearch, period, storeId]);

  function onPeriodChange(next: ExpiryPeriod) {
    setPeriod(next);
    setStoredExpiryPeriod(next);
  }

  const loadEntries = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!storeId) return;

      loadingMoreRef.current = true;
      setLoading(true);
      const params = new URLSearchParams({
        storeId,
        withinDays: expiryPeriodToApiParam(period),
      });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      } else {
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_SIZE));
      }

      try {
        const response = await fetch(`/api/inventory?${params.toString()}`);
        const data = (await response.json()) as {
          entries?: Entry[];
          pagination?: Pagination;
        };

        const nextEntries = data.entries ?? [];
        setEntries((current) => (append ? [...current, ...nextEntries] : nextEntries));
        setPagination(
          data.pagination ?? {
            page: targetPage,
            limit: PAGE_SIZE,
            total: nextEntries.length,
            totalPages: 1,
          },
        );
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
      }
    },
    [storeId, debouncedSearch, period],
  );

  useEffect(() => {
    if (storeId) {
      void loadEntries(page, page > 1);
    }
  }, [storeId, debouncedSearch, page, period, loadEntries]);

  useEffect(() => {
    if (debouncedSearch || loading) return;

    const node = loadMoreRef.current;
    if (!node || pagination.page >= pagination.totalPages) return;

    const observer = new IntersectionObserver(
      (records) => {
        if (!records[0]?.isIntersecting || loadingMoreRef.current) return;
        setPage((current) =>
          current < pagination.totalPages ? current + 1 : current,
        );
      },
      { rootMargin: "160px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [debouncedSearch, loading, pagination.page, pagination.totalPages, entries.length]);

  async function removeEntry(entryId: string) {
    await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, storeId }),
    });
    setConfirmId(null);
    setPage(1);
    setEntries([]);
    await loadEntries(1, false);
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("expiry.noResults") : t("expiry.empty");

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
      <MobilePageHeader title={t("expiry.title")} />

      <ExpiryPeriodFilter value={period} onChange={onPeriodChange} />

      <div className="mb-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          placeholder={t("expiry.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowScanner((open) => !open)}
          className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-xs font-medium ${
            showScanner
              ? "border-primary bg-selected text-primary"
              : "border-input-border bg-card text-muted"
          }`}
        >
          <ScanNavIcon className="h-6 w-6" />
          <span>{t("app.navScan")}</span>
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
            autoStart
            submitOnScan
            onScan={async (barcode) => onBarcodeScanned(barcode)}
            onCancel={() => setShowScanner(false)}
          />
        </div>
      ) : null}

      <div className="space-y-1 pt-1">
        {loading && page === 1 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {t("expiry.loading")}
          </p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {!loading || page > 1
          ? entries.map((entry) => (
              <ExpiryListCard
                key={entry.id}
                name={entry.product.name}
                imagePath={entry.product.imagePath}
                expiryDate={entry.expiryDate}
                enteredAt={entry.enteredAt}
                quantity={entry.quantity}
                onRemove={() => setConfirmId(entry.id)}
              />
            ))
          : null}

        {!isSearching && pagination.page < pagination.totalPages ? (
          <div ref={loadMoreRef} className="h-2" aria-hidden />
        ) : null}

        {loading && page > 1 ? (
          <p className="py-2 text-center text-xs text-muted">{t("expiry.loading")}</p>
        ) : null}
      </div>

      {confirmId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">{t("expiry.confirmTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("expiry.confirmMessage")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => setConfirmId(null)}
                >
                  {t("expiry.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-danger px-3 py-2 text-sm text-danger-fg"
                  onClick={() => void removeEntry(confirmId)}
                >
                  {t("expiry.remove")}
                </button>
              </div>
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
