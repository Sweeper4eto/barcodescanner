"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { CameraCapture, prepareDocumentImage } from "@/components/camera-capture";
import { assessDocumentPhotoQuality } from "@/lib/document-image";
import { DocumentDraftDetailSheet } from "@/components/document-draft-detail-sheet";
import { DocumentDraftListCard } from "@/components/document-draft-list-card";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import { goBackOrApp, navigateApp } from "@/lib/app-navigation";
import { useBrowserBackStack } from "@/lib/browser-back";
import {
  type DocumentDraftItem,
  draftItemValid,
  draftMatchesSearch,
} from "@/lib/document-draft";

type Step = "camera" | "processing" | "review";

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function AddDocumentContent() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("camera");
  const [items, setItems] = useState<DocumentDraftItem[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [removeKey, setRemoveKey] = useState<string | null>(null);

  const detailItem = useMemo(
    () => items.find((item) => item.key === detailKey) ?? null,
    [detailKey, items],
  );

  useBrowserBackStack([
    {
      id: "draft-detail",
      open: detailKey !== null,
      close: () => setDetailKey(null),
    },
    {
      id: "draft-remove",
      open: removeKey !== null,
      close: () => setRemoveKey(null),
    },
  ]);

  useEffect(() => {
    let cancelled = false;
    async function guard() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (cancelled) return;
        if (!data.user) {
          router.replace("/login");
          return;
        }
        if (data.user.homeUser) {
          router.replace(
            storeId
              ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
              : "/app",
          );
          return;
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void guard();
    return () => {
      cancelled = true;
    };
  }, [router, storeId]);

  async function parseDocument(dataUrl: string, attempt = 0): Promise<Response> {
    return fetch("/api/documents/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, dataUrl }),
    }).then(async (response) => {
      if (
        attempt < 1 &&
        (response.status === 502 || response.status === 503 || response.status === 504)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return parseDocument(dataUrl, attempt + 1);
      }
      return response;
    });
  }

  async function onCapture(dataUrl: string) {
    if (!storeId) return;
    setError("");
    setStep("processing");
    try {
      const quality = await assessDocumentPhotoQuality(dataUrl);
      if (!quality.ok) {
        const key =
          quality.reason === "blurry"
            ? "errors.documentPhotoBlurry"
            : quality.reason === "glare"
              ? "errors.documentPhotoGlare"
              : quality.reason === "tooDark"
                ? "errors.documentPhotoTooDark"
                : "errors.documentPhotoTooSmall";
        setError(t(key));
        setStep("camera");
        return;
      }

      const prepared = await prepareDocumentImage(dataUrl);
      const response = await parseDocument(prepared);
      if (response.status === 413) {
        setError(t("errors.documentTooLarge"));
        setStep("camera");
        return;
      }
      if (response.status === 504) {
        setError(t("errors.documentTimeout"));
        setStep("camera");
        return;
      }
      type ParsedItem = {
        name?: string;
        barcode?: string | null;
        articul?: string | null;
        expiryYmd?: string | null;
        quantity?: number;
        productId?: string | null;
        productImagePath?: string | null;
        matchSource?: "barcode" | "articul" | "name" | null;
      };

      const rawText = await response.text();
      let data: { error?: string; items?: ParsedItem[] } | null = null;
      try {
        data = JSON.parse(rawText) as { error?: string; items?: ParsedItem[] };
      } catch {
        setError(
          response.ok
            ? t("errors.documentParseFailed")
            : response.status === 502 || response.status === 503
              ? t("errors.documentTimeout")
              : t("errors.documentParseFailed"),
        );
        setStep("camera");
        return;
      }
      if (!response.ok || !data?.items) {
        setError(
          typeof data?.error === "string" && data.error
            ? data.error
            : t("errors.documentParseFailed"),
        );
        setStep("camera");
        return;
      }

      const next: DocumentDraftItem[] = data.items.map((item: ParsedItem) => ({
        key: newKey(),
        name: item.name ?? "",
        barcode: item.barcode ?? "",
        articul: item.articul ?? "",
        expiryYmd: item.expiryYmd ?? "",
        quantity: String(item.quantity && item.quantity >= 1 ? item.quantity : 1),
        productId: item.productId ?? null,
        productImagePath: item.productImagePath ?? null,
        matchSource: item.matchSource ?? null,
      }));
      setItems(next);
      setSearch("");
      setStep("review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(message || t("errors.documentParseFailed"));
      setStep("camera");
    }
  }

  function updateItem(key: string, patch: Partial<DocumentDraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
    setRemoveKey(null);
    if (detailKey === key) setDetailKey(null);
  }

  const filteredItems = useMemo(
    () => items.filter((item) => draftMatchesSearch(item, search)),
    [items, search],
  );

  const canImport =
    items.length > 0 && items.every((item) => draftItemValid(item));

  async function confirmImport() {
    if (!canImport || !storeId || importing) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          items: items.map((item) => ({
            name: item.name.trim(),
            barcode: item.barcode.trim() || null,
            articul: item.articul.trim() || null,
            expiryYmd: item.expiryYmd,
            quantity: Number(item.quantity),
            productId: item.productId,
          })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      navigateApp(`/app/expiry?storeId=${encodeURIComponent(storeId)}`);
    } catch {
      setError(t("errors.saveFailed"));
    } finally {
      setImporting(false);
    }
  }

  if (checking) {
    return (
      <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
        <MobilePageHeader title={t("addDocument.title")} />
        <p className="text-sm text-muted">{t("expiry.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-3">
      <MobilePageHeader title={t("addDocument.title")} />

      {step === "camera" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">{t("addDocument.hint")}</p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <CameraCapture
            autoStart
            allowFileUpload
            compact
            onCapture={(dataUrl) => void onCapture(dataUrl)}
            onCancel={() =>
              goBackOrApp(
                storeId
                  ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
                  : "/app",
              )
            }
          />
        </div>
      ) : null}

      {step === "processing" ? (
        <div className="rounded-2xl border border-card-border p-6 text-center">
          <p className="text-sm text-muted">{t("addDocument.processing")}</p>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("addDocument.reviewTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("addDocument.reviewHint")}</p>
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}

          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("addDocument.searchPlaceholder")}
            aria-label={t("addDocument.searchPlaceholder")}
            inputClassName="rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          />

          <div className="space-y-1 pt-1">
            {filteredItems.length === 0 ? (
              <p className="rounded-xl bg-subtle p-4 text-sm text-muted">
                {items.length === 0
                  ? t("addDocument.emptyReview")
                  : t("addDocument.noResults")}
              </p>
            ) : null}
            {filteredItems.map((item) => (
              <DocumentDraftListCard
                key={item.key}
                item={item}
                onOpen={() => setDetailKey(item.key)}
                onRemove={() => setRemoveKey(item.key)}
              />
            ))}
          </div>

          <div className="sticky bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-10 space-y-2 border-t border-card-border bg-background pt-3 pb-2">
            <PrimaryButton
              onClick={() => void confirmImport()}
              disabled={!canImport || importing}
            >
              {importing ? t("addDocument.importing") : t("addDocument.confirmImport")}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setItems([]);
                setSearch("");
                setDetailKey(null);
                setError("");
                setStep("camera");
              }}
            >
              {t("addDocument.retake")}
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {detailItem ? (
        <DocumentDraftDetailSheet
          item={detailItem}
          onClose={() => setDetailKey(null)}
          onSave={(patch) => updateItem(detailItem.key, patch)}
        />
      ) : null}

      {removeKey ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-remove-title"
        >
          <div className="w-full max-w-lg px-3 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.5rem)]">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p id="doc-remove-title" className="text-sm font-semibold">
                {t("expiry.confirmTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("addDocument.removeConfirmMessage")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => setRemoveKey(null)}
                >
                  {t("expiry.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-danger px-3 py-2 text-sm text-danger-fg"
                  onClick={() => removeItem(removeKey)}
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

export default function AddDocumentPage() {
  return (
    <Suspense>
      <AddDocumentContent />
    </Suspense>
  );
}
