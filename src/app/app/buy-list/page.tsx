"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ActionFlash } from "@/components/action-flash";
import { SecondaryButton } from "@/components/auth-forms";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ScanNavIcon } from "@/components/app-nav-icons";
import { BuyListCard } from "@/components/buy-list-card";
import {
  BuyListEntryDetailSheet,
  type BuyListDetailEntry,
} from "@/components/buy-list-entry-detail-sheet";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { QuantityPicker } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { useBrowserBackStack } from "@/lib/browser-back";
import { expiryYmdToIso } from "@/lib/inventory";

const PAGE_SIZE = 20;

type Entry = {
  id: string;
  barcode: string;
  quantity: number;
  enteredAt: string;
  product: { id: string; name: string; imagePath: string | null };
};

type FavouriteProduct = {
  id: string;
  name: string;
  barcode: string;
  imagePath: string | null;
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
  const [moveToExpiryId, setMoveToExpiryId] = useState<string | null>(null);
  const [moveExpiryYmd, setMoveExpiryYmd] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [detailEntry, setDetailEntry] = useState<BuyListDetailEntry | null>(null);
  const [favouriteProductIds, setFavouriteProductIds] = useState<
    Record<string, true>
  >({});
  const [favourites, setFavourites] = useState<FavouriteProduct[]>([]);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashTone, setFlashTone] = useState<"success" | "error">("success");
  const [addingFavouriteId, setAddingFavouriteId] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualImagePath, setManualImagePath] = useState<string | null>(null);
  const [manualCapturing, setManualCapturing] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(storeId));
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
      id: "move-to-expiry",
      open: moveToExpiryId !== null,
      close: () => {
        setMoveToExpiryId(null);
        setMoveExpiryYmd("");
      },
    },
    {
      id: "manual-add",
      open: showManualAdd,
      close: () => {
        setShowManualAdd(false);
        setManualCapturing(false);
      },
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

  const loadFavourites = useCallback(async () => {
    if (!storeId || homeUser !== true) return;

    const response = await fetch(
      `/api/favourites?storeId=${encodeURIComponent(storeId)}`,
    );
    const data = (await response.json()) as {
      favourites?: Array<{ product: FavouriteProduct }>;
      productIds?: string[];
    };

    if (!response.ok) return;

    setFavourites((data.favourites ?? []).map((item) => item.product));
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

  async function reloadList() {
    setPage(1);
    setEntries([]);
    await loadEntries(1, false);
  }

  async function removeEntry(entryId: string) {
    try {
      const response = await fetch("/api/buy-list", {
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

  async function confirmMoveToExpiry() {
    if (!moveToExpiryId || !moveExpiryYmd || moveSaving) return;

    setMoveSaving(true);
    try {
      const response = await fetch("/api/buy-list/move-to-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          entryId: moveToExpiryId,
          expiryDate: expiryYmdToIso(moveExpiryYmd),
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.moveToExpiryFailed"));
        return;
      }

      setMoveToExpiryId(null);
      setMoveExpiryYmd("");
      setDetailEntry((current) =>
        current?.id === moveToExpiryId ? null : current,
      );
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.movedToExpiry"));
    } finally {
      setMoveSaving(false);
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

  async function addFavouriteToOrders(product: FavouriteProduct) {
    if (addingFavouriteId) return;
    setAddingFavouriteId(product.id);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: product.id,
          barcode: product.barcode,
          quantity: 1,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.addFailed"));
        return;
      }
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.addedFromFavourite"));
    } finally {
      setAddingFavouriteId(null);
    }
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

  function resetManualAdd() {
    setShowManualAdd(false);
    setManualName("");
    setManualQty("1");
    setManualImagePath(null);
    setManualCapturing(false);
    setManualSaving(false);
  }

  async function confirmManualAdd() {
    const quantity = Number(manualQty);
    if (!Number.isInteger(quantity) || quantity < 1) return;
    if (!manualName.trim() && !manualImagePath) {
      setFlashTone("error");
      setFlashMessage(t("errors.invalidData"));
      return;
    }
    if (manualSaving) return;

    setManualSaving(true);
    try {
      const response = await fetch("/api/buy-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          name: manualName.trim() || undefined,
          imagePath: manualImagePath,
          quantity,
        }),
      });
      if (!response.ok) {
        setFlashTone("error");
        setFlashMessage(t("buyList.addFailed"));
        return;
      }
      resetManualAdd();
      await reloadList();
      setFlashTone("success");
      setFlashMessage(t("buyList.addedManual"));
    } finally {
      setManualSaving(false);
    }
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

      <ActionFlash
        message={flashMessage}
        tone={flashTone}
        onClear={clearFlash}
      />

      <div className="mb-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          aria-label={t("buyList.searchPlaceholder")}
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
        <button
          type="button"
          onClick={() => {
            setShowScanner(false);
            setShowManualAdd(true);
          }}
          className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-primary bg-selected px-3 py-2 text-xs font-medium text-primary"
        >
          <span className="text-lg leading-none">+</span>
          <span>{t("buyList.addManual")}</span>
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

      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          {t("buyList.favouritesTitle")}
        </h2>
        {favourites.length === 0 ? (
          <p className="rounded-xl bg-subtle p-3 text-xs text-muted">
            {t("buyList.favouritesEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {favourites.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-2 rounded-lg border border-card-border bg-card px-2 py-1.5"
              >
                <ProductImage
                  src={product.imagePath}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-md object-cover"
                  placeholderClassName="h-10 w-10 shrink-0 rounded-md text-[9px]"
                />
                <p className="min-w-0 flex-1 line-clamp-2 text-xs font-semibold leading-tight text-foreground">
                  {product.name}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-fg disabled:opacity-60"
                  disabled={addingFavouriteId === product.id}
                  onClick={() => void addFavouriteToOrders(product)}
                >
                  {addingFavouriteId === product.id
                    ? t("buyList.adding")
                    : t("buyList.addFavouriteToOrders")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
            favourite={Boolean(favouriteProductIds[entry.product.id])}
            onOpen={() => setDetailEntry(entry)}
            onRemove={() => setConfirmId(entry.id)}
            onMoveToExpiry={() => {
              setMoveToExpiryId(entry.id);
              setMoveExpiryYmd("");
            }}
            onToggleFavourite={() => void toggleFavourite(entry.product.id)}
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
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orders-confirm-title"
        >
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p id="orders-confirm-title" className="text-sm font-semibold">{t("buyList.confirmTitle")}</p>
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

      {moveToExpiryId ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">
                {t("buyList.moveToExpiryTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("buyList.moveToExpiryMessage")}
              </p>
              <div className="mt-3">
                <ExpiryDatePicker
                  value={moveExpiryYmd}
                  onChange={setMoveExpiryYmd}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => {
                    setMoveToExpiryId(null);
                    setMoveExpiryYmd("");
                  }}
                  disabled={moveSaving}
                >
                  {t("buyList.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                  onClick={() => void confirmMoveToExpiry()}
                  disabled={!moveExpiryYmd || moveSaving}
                >
                  {moveSaving
                    ? t("buyList.saving")
                    : t("buyList.moveToExpiryConfirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showManualAdd ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="max-h-[80vh] space-y-3 overflow-y-auto rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">{t("buyList.addManualTitle")}</p>
              <p className="text-xs text-muted">{t("buyList.addManualHint")}</p>

              {manualCapturing ? (
                <CameraCapture
                  allowFileUpload
                  onCapture={(dataUrl) => {
                    void (async () => {
                      try {
                        const path = await uploadImage(dataUrl);
                        setManualImagePath(path);
                        setManualCapturing(false);
                      } catch {
                        setFlashTone("error");
                        setFlashMessage(t("errors.uploadFailed"));
                      }
                    })();
                  }}
                  onCancel={() => setManualCapturing(false)}
                />
              ) : (
                <>
                  <ProductImage
                    src={manualImagePath}
                    alt=""
                    className="mx-auto h-28 w-28 rounded-xl object-cover"
                    placeholderClassName="mx-auto h-28 w-28 rounded-xl"
                  />
                  <SecondaryButton onClick={() => setManualCapturing(true)}>
                    {manualImagePath
                      ? t("expiry.changePicture")
                      : t("buyList.addManualPhoto")}
                  </SecondaryButton>
                </>
              )}

              <label className="block text-sm font-medium text-foreground">
                {t("buyList.addManualName")}
                <input
                  className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  placeholder={t("common.noName")}
                  disabled={manualSaving || manualCapturing}
                />
              </label>

              <QuantityPicker
                value={manualQty}
                onChange={setManualQty}
                startWithGridOpen={false}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={resetManualAdd}
                  disabled={manualSaving}
                >
                  {t("buyList.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                  disabled={
                    manualSaving ||
                    manualCapturing ||
                    (!manualName.trim() && !manualImagePath) ||
                    !manualQty ||
                    !Number.isInteger(Number(manualQty)) ||
                    Number(manualQty) < 1
                  }
                  onClick={() => void confirmManualAdd()}
                >
                  {manualSaving
                    ? t("buyList.adding")
                    : t("buyList.addManualConfirm")}
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
