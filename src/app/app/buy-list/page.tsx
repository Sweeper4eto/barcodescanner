"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon } from "@/components/app-nav-icons";
import { BuyListCard } from "@/components/buy-list-card";
import {
  BuyListEntryDetailSheet,
  type BuyListDetailEntry,
} from "@/components/buy-list-entry-detail-sheet";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useBrowserBackStack } from "@/lib/browser-back";

const PAGE_SIZE = 20;

type Entry = {
  id: string;
  barcode: string;
  quantity: number;
  enteredAt: string;
  product: { name: string; imagePath: string | null };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function BuyListContent() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [homeUser, setHomeUser] = useState<boolean | null>(null);
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
  const [detailEntry, setDetailEntry] = useState<BuyListDetailEntry | null>(null);
  const [loading, setLoading] = useState(() => Boolean(storeId));
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const fetchGenerationRef = useRef(0);

  useBrowserBackStack([
    {
      id: "scanner",
      open: showScanner,
      close: () => setShowScanner(false),
    },
    {
      id: "detail",
      open: detailEntry !== null,
      close: () => setDetailEntry(null),
    },
    {
      id: "confirm",
      open: confirmId !== null,
      close: () => setConfirmId(null),
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (!cancelled) {
        setHomeUser(Boolean(data.user?.homeUser));
      }
    }

    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, storeId]);

  const loadEntries = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!storeId || homeUser !== true) return;

      const generation = ++fetchGenerationRef.current;
      loadingMoreRef.current = true;
      setLoading(true);
      const params = new URLSearchParams({ storeId });
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      } else {
        params.set("page", String(targetPage));
        params.set("limit", String(PAGE_SIZE));
      }

      try {
        const response = await fetch(`/api/buy-list?${params.toString()}`);
        const data = (await response.json()) as {
          entries?: Entry[];
          pagination?: Pagination;
        };

        if (generation !== fetchGenerationRef.current) return;

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
        if (generation === fetchGenerationRef.current) {
          loadingMoreRef.current = false;
          setLoading(false);
        }
      }
    },
    [storeId, debouncedSearch, homeUser],
  );

  useEffect(() => {
    if (storeId && homeUser === true) {
      void loadEntries(page, page > 1 && !debouncedSearch);
    }
  }, [storeId, debouncedSearch, page, homeUser, loadEntries]);

  useEffect(() => {
    if (debouncedSearch || loading || homeUser !== true) return;

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
  }, [
    debouncedSearch,
    loading,
    homeUser,
    pagination.page,
    pagination.totalPages,
    entries.length,
  ]);

  async function removeEntry(entryId: string) {
    await fetch("/api/buy-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, storeId }),
    });
    setConfirmId(null);
    setDetailEntry((current) => (current?.id === entryId ? null : current));
    setPage(1);
    setEntries([]);
    await loadEntries(1, false);
  }

  function handleEntryUpdated(updated: BuyListDetailEntry) {
    setDetailEntry((current) => (current?.id === updated.id ? updated : current));
    setEntries((current) =>
      current.map((entry) =>
        entry.id === updated.id
          ? {
              ...entry,
              barcode: updated.barcode,
              quantity: updated.quantity,
              product: updated.product,
            }
          : entry,
      ),
    );
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("buyList.noResults") : t("buyList.empty");

  if (homeUser === null) {
    return (
      <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
        <MobilePageHeader title={t("buyList.title")} />
        <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
          {t("buyList.loading")}
        </p>
      </div>
    );
  }

  if (!homeUser) {
    return (
      <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
        <MobilePageHeader title={t("buyList.title")} />
        <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
          {t("buyList.unavailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
      <MobilePageHeader title={t("buyList.title")} />

      <div className="mb-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          placeholder={t("buyList.searchPlaceholder")}
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
          {t("buyList.clearSearch")}
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
        {loading && page === 1 && entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {isSearching ? t("buyList.searching") : t("buyList.loading")}
          </p>
        ) : null}

        {loading && isSearching && entries.length > 0 ? (
          <p className="py-1 text-center text-xs text-muted">{t("buyList.searching")}</p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {entries.map((entry) => (
          <BuyListCard
            key={entry.id}
            name={entry.product.name}
            imagePath={entry.product.imagePath}
            enteredAt={entry.enteredAt}
            quantity={entry.quantity}
            onOpen={() => setDetailEntry(entry)}
            onRemove={() => setConfirmId(entry.id)}
          />
        ))}

        {!isSearching && pagination.page < pagination.totalPages ? (
          <div ref={loadMoreRef} className="h-2" aria-hidden />
        ) : null}

        {loading && page > 1 ? (
          <p className="py-2 text-center text-xs text-muted">{t("buyList.loading")}</p>
        ) : null}
      </div>

      {detailEntry ? (
        <BuyListEntryDetailSheet
          entry={detailEntry}
          storeId={storeId}
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      ) : null}

      {confirmId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">{t("buyList.confirmTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("buyList.confirmMessage")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => setConfirmId(null)}
                >
                  {t("buyList.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-danger px-3 py-2 text-sm text-danger-fg"
                  onClick={() => void removeEntry(confirmId)}
                >
                  {t("buyList.remove")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function BuyListPage() {
  return (
    <Suspense>
      <BuyListContent />
    </Suspense>
  );
}
