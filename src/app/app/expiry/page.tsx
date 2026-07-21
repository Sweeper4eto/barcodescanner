"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon } from "@/components/app-nav-icons";
import { ExpiryListCard } from "@/components/expiry-list-card";
import {
  ExpiryEntryDetailSheet,
  type ExpiryDetailEntry,
} from "@/components/expiry-entry-detail-sheet";
import { ExpiryPeriodFilter } from "@/components/expiry-period-filter";
import { ActionFlash } from "@/components/action-flash";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { QuantityPicker } from "@/components/quantity-picker";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import {
  type ExpiryPeriod,
  DEFAULT_EXPIRY_PERIOD,
  expiryPeriodToApiParam,
  getStoredExpiryPeriod,
  setStoredExpiryPeriod,
} from "@/lib/expiry-period";
import { useBrowserBackStack } from "@/lib/browser-back";
import { resolveEntryImagePath } from "@/lib/inventory-entry-display";

const PAGE_SIZE = 20;

type Entry = {
  id: string;
  barcode: string;
  articul: string | null;
  imagePath: string | null;
  quantity: number;
  enteredAt: string;
  expiryDate: string;
  priceReducedAt: string | null;
  product: { id: string; name: string; imagePath: string | null };
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
  const [priceReduceConfirmId, setPriceReduceConfirmId] = useState<string | null>(null);
  const [moveToOrdersEntry, setMoveToOrdersEntry] = useState<Entry | null>(null);
  const [moveOrdersQty, setMoveOrdersQty] = useState("1");
  const [moveOrdersSaving, setMoveOrdersSaving] = useState(false);
  const [detailEntry, setDetailEntry] = useState<ExpiryDetailEntry | null>(null);
  const [favouriteProductIds, setFavouriteProductIds] = useState<
    Record<string, true>
  >({});
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(() => Boolean(storeId));
  const [period, setPeriod] = useState<ExpiryPeriod>(DEFAULT_EXPIRY_PERIOD);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const clearFlash = useCallback(() => setFlashMessage(null), []);
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
    {
      id: "price-reduce",
      open: priceReduceConfirmId !== null,
      close: () => setPriceReduceConfirmId(null),
    },
    {
      id: "move-to-orders",
      open: moveToOrdersEntry !== null,
      close: () => {
        setMoveToOrdersEntry(null);
        setMoveOrdersQty("1");
      },
    },
  ]);

  useEffect(() => {
    setPeriod(getStoredExpiryPeriod());
  }, []);

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

  const loadFavourites = useCallback(async () => {
    if (!storeId || homeUser !== true) return;

    const response = await fetch(
      `/api/favourites?storeId=${encodeURIComponent(storeId)}`,
    );
    const data = (await response.json()) as { productIds?: string[] };
    if (!response.ok) return;

    const nextIds: Record<string, true> = {};
    for (const id of data.productIds ?? []) {
      nextIds[id] = true;
    }
    setFavouriteProductIds(nextIds);
  }, [storeId, homeUser]);

  useEffect(() => {
    if (storeId && homeUser === true) {
      void loadFavourites();
    }
  }, [storeId, homeUser, loadFavourites]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period, storeId]);

  function onPeriodChange(next: ExpiryPeriod) {
    setPeriod(next);
    setStoredExpiryPeriod(next);
  }

  const loadEntries = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!storeId) return;

      const generation = ++fetchGenerationRef.current;
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

        if (generation !== fetchGenerationRef.current) return;

        const nextEntries = (data.entries ?? []).map((entry) => ({
          ...entry,
          articul: entry.articul ?? null,
          imagePath: entry.imagePath ?? null,
        }));
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
    [storeId, debouncedSearch, period],
  );

  useEffect(() => {
    if (storeId) {
      void loadEntries(page, page > 1 && !debouncedSearch);
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
    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, storeId }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
        return;
      }
      setConfirmId(null);
      setDetailEntry((current) => (current?.id === entryId ? null : current));
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  async function reducePriceEntry(entryId: string) {
    const response = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, storeId, priceReduced: true }),
    });
    const data = (await response.json()) as {
      entry?: ExpiryDetailEntry;
    };
    setPriceReduceConfirmId(null);
    if (response.ok && data.entry) {
      handleEntryUpdated(data.entry);
    }
  }

  async function confirmMoveToOrders() {
    if (!moveToOrdersEntry || moveOrdersSaving) return;

    const quantity = Number(moveOrdersQty);
    if (!Number.isInteger(quantity) || quantity < 1) return;

    setMoveOrdersSaving(true);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: moveToOrdersEntry.product.id,
          barcode: moveToOrdersEntry.barcode,
          quantity,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("expiry.addToOrdersFailed"));
        return;
      }

      setMoveToOrdersEntry(null);
      setMoveOrdersQty("1");
      setFlashTone("success");
      setFlashMessage(t("expiry.addedToOrders"));
    } finally {
      setMoveOrdersSaving(false);
    }
  }

  async function toggleFavourite(productId: string) {
    const isFavourite = Boolean(favouriteProductIds[productId]);
    try {
      const response = await fetch("/api/favourites", {
        method: isFavourite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, productId }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("errors.networkError"));
        return;
      }
      await loadFavourites();
    } catch {
      setFlashTone("error");
      setFlashMessage(t("errors.networkError"));
    }
  }

  function handleEntryUpdated(
    updated: ExpiryDetailEntry,
    meta?: { merged?: boolean; removedId?: string },
  ) {
    setDetailEntry((current) => (current?.id === updated.id ? updated : current));
    setEntries((current) => {
      let next = current;

      if (meta?.removedId) {
        next = next.filter((entry) => entry.id !== meta.removedId);
      } else {
        next = next.map((entry) =>
          entry.id === updated.id
            ? {
                ...entry,
                barcode: updated.barcode,
                articul: updated.articul ?? null,
                imagePath: updated.imagePath ?? null,
                quantity: updated.quantity,
                expiryDate: updated.expiryDate,
                priceReducedAt: updated.priceReducedAt,
                product: updated.product,
              }
            : entry,
        );
      }

      const hasUpdated = next.some((entry) => entry.id === updated.id);
      if (!hasUpdated) {
        next = [
          ...next,
          {
            id: updated.id,
            barcode: updated.barcode,
            articul: updated.articul ?? null,
            imagePath: updated.imagePath ?? null,
            quantity: updated.quantity,
            enteredAt: new Date().toISOString(),
            expiryDate: updated.expiryDate,
            priceReducedAt: updated.priceReducedAt,
            product: updated.product,
          },
        ];
      }

      return [...next].sort(
        (a, b) =>
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      );
    });
  }

  function onBarcodeScanned(barcode: string) {
    setSearch(barcode);
    setShowScanner(false);
  }

  const isSearching = debouncedSearch.length > 0;
  const emptyMessage = isSearching ? t("expiry.noResults") : t("expiry.empty");
  const isHomeUser = homeUser === true;

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
      <MobilePageHeader title={t("expiry.title")} />

      <ActionFlash
        message={flashMessage}
        tone={flashTone}
        onClear={clearFlash}
      />

      <ExpiryPeriodFilter value={period} onChange={onPeriodChange} />

      <div className="mb-2 flex items-center gap-1.5">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("expiry.searchPlaceholder")}
          aria-label={t("expiry.searchPlaceholder")}
          inputClassName="h-9 rounded-lg border border-input-border bg-input px-2.5 text-sm text-foreground"
          onClear={() => setShowScanner(false)}
        />
        <button
          type="button"
          onClick={() => setShowScanner((open) => !open)}
          className={`flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-[10px] font-medium leading-none ${
            showScanner
              ? "border-primary bg-selected text-primary"
              : "border-input-border bg-card text-muted"
          }`}
        >
          <ScanNavIcon className="h-4 w-4" />
          <span>{t("app.navScan")}</span>
        </button>
      </div>

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
            {isSearching ? t("expiry.searching") : t("expiry.loading")}
          </p>
        ) : null}

        {loading && isSearching && entries.length > 0 ? (
          <p className="py-1 text-center text-xs text-muted">{t("expiry.searching")}</p>
        ) : null}

        {!loading && entries.length === 0 ? (
          <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
            {emptyMessage}
          </p>
        ) : null}

        {entries.map((entry) => (
          <ExpiryListCard
            key={entry.id}
            name={entry.product.name.trim() || t("common.noName")}
            imagePath={resolveEntryImagePath(entry.imagePath, entry.product.imagePath)}
            articul={entry.articul}
            expiryDate={entry.expiryDate}
            enteredAt={entry.enteredAt}
            quantity={entry.quantity}
            priceReduced={entry.priceReducedAt !== null}
            homeUser={isHomeUser}
            favourite={Boolean(favouriteProductIds[entry.product.id])}
            onOpen={() => setDetailEntry(entry)}
            onRemove={() => setConfirmId(entry.id)}
            onReducePrice={() => setPriceReduceConfirmId(entry.id)}
            onMoveToOrders={() => {
              setMoveToOrdersEntry(entry);
              setMoveOrdersQty("1");
            }}
            onToggleFavourite={
              isHomeUser
                ? () => void toggleFavourite(entry.product.id)
                : undefined
            }
          />
        ))}

        {!isSearching && pagination.page < pagination.totalPages ? (
          <div ref={loadMoreRef} className="h-2" aria-hidden />
        ) : null}

        {loading && page > 1 ? (
          <p className="py-2 text-center text-xs text-muted">{t("expiry.loading")}</p>
        ) : null}
      </div>

      {detailEntry ? (
        <ExpiryEntryDetailSheet
          entry={detailEntry}
          storeId={storeId}
          onClose={() => setDetailEntry(null)}
          onUpdated={handleEntryUpdated}
        />
      ) : null}

      {confirmId ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expiry-confirm-title"
        >
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p id="expiry-confirm-title" className="text-sm font-semibold">{t("expiry.confirmTitle")}</p>
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

      {priceReduceConfirmId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">
                {t("expiry.reducePriceConfirmTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("expiry.reducePriceConfirmMessage")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => setPriceReduceConfirmId(null)}
                >
                  {t("expiry.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
                  onClick={() => void reducePriceEntry(priceReduceConfirmId)}
                >
                  {t("expiry.reducePrice")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {moveToOrdersEntry ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">
                {t("expiry.moveToOrdersTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("expiry.moveToOrdersMessage")}
              </p>
              <div className="mt-3">
                <QuantityPicker
                  value={moveOrdersQty}
                  onChange={setMoveOrdersQty}
                  startWithGridOpen
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => {
                    setMoveToOrdersEntry(null);
                    setMoveOrdersQty("1");
                  }}
                  disabled={moveOrdersSaving}
                >
                  {t("expiry.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                  onClick={() => void confirmMoveToOrders()}
                  disabled={
                    moveOrdersSaving ||
                    !moveOrdersQty ||
                    !Number.isInteger(Number(moveOrdersQty)) ||
                    Number(moveOrdersQty) < 1
                  }
                >
                  {moveOrdersSaving
                    ? t("expiry.saving")
                    : t("expiry.moveToOrdersConfirm")}
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
