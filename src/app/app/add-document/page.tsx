"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { CameraCapture, prepareDocumentImage } from "@/components/camera-capture";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { QuantityPicker } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { goBackOrApp, navigateApp } from "@/lib/app-navigation";

type DraftItem = {
  key: string;
  name: string;
  barcode: string;
  articul: string;
  expiryYmd: string;
  quantity: string;
  productId: string | null;
  productImagePath: string | null;
  matchSource: "barcode" | "articul" | "name" | null;
};

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
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

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

  async function onCapture(dataUrl: string) {
    if (!storeId) return;
    setError("");
    setStep("processing");
    try {
      // Send image in the parse request (same path as the working server test).
      // Skipping /api/upload avoids disk/cwd/size failures that only hit phones.
      const prepared = await prepareDocumentImage(dataUrl);
      const response = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, dataUrl: prepared }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.items) {
        setError(
          typeof data?.error === "string" && data.error
            ? data.error
            : t("errors.documentParseFailed"),
        );
        setStep("camera");
        return;
      }

      const next: DraftItem[] = data.items.map(
        (item: {
          name?: string;
          barcode?: string | null;
          articul?: string | null;
          expiryYmd?: string | null;
          quantity?: number;
          productId?: string | null;
          productImagePath?: string | null;
          matchSource?: "barcode" | "articul" | "name" | null;
        }) => ({
          key: newKey(),
          name: item.name ?? "",
          barcode: item.barcode ?? "",
          articul: item.articul ?? "",
          expiryYmd: item.expiryYmd ?? "",
          quantity: String(item.quantity && item.quantity >= 1 ? item.quantity : 1),
          productId: item.productId ?? null,
          productImagePath: item.productImagePath ?? null,
          matchSource: item.matchSource ?? null,
        }),
      );
      setItems(next);
      setStep("review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(message || t("errors.documentParseFailed"));
      setStep("camera");
    }
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  const canImport =
    items.length > 0 &&
    items.every((item) => {
      const qty = Number(item.quantity);
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(item.expiryYmd) &&
        Number.isInteger(qty) &&
        qty >= 1
      );
    });

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
    <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
      <MobilePageHeader title={t("addDocument.title")} />

      {step === "camera" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">{t("addDocument.hint")}</p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <CameraCapture
            autoStart
            allowFileUpload
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
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("addDocument.reviewTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">{t("addDocument.reviewHint")}</p>
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}

          <div className="space-y-3">
            {items.map((item) => {
              const expiryOk = /^\d{4}-\d{2}-\d{2}$/.test(item.expiryYmd);
              return (
                <article
                  key={item.key}
                  className="space-y-3 rounded-2xl border border-card-border p-3"
                >
                  <div className="flex items-start gap-3">
                    <ProductImage
                      src={item.productImagePath}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      placeholderClassName="h-14 w-14 shrink-0 rounded-lg text-[9px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[11px] font-semibold ${
                          item.matchSource ? "text-primary" : "text-muted"
                        }`}
                      >
                        {item.matchSource
                          ? t("addDocument.matched")
                          : t("addDocument.unmatched")}
                      </p>
                      <label className="mt-1 block text-sm font-medium text-foreground">
                        {t("common.name")}
                        <input
                          className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.key, { name: event.target.value })
                          }
                          placeholder={t("common.noName")}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-foreground">
                      {t("common.barcode")}
                      <input
                        className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 font-mono text-sm text-foreground"
                        value={item.barcode}
                        onChange={(event) =>
                          updateItem(item.key, {
                            barcode: event.target.value,
                            productId: null,
                            productImagePath: null,
                            matchSource: null,
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium text-foreground">
                      {t("common.articul")}
                      <input
                        className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
                        value={item.articul}
                        onChange={(event) =>
                          updateItem(item.key, { articul: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  <QuantityPicker
                    value={item.quantity}
                    onChange={(value) => updateItem(item.key, { quantity: value })}
                    startWithGridOpen={false}
                  />

                  <div>
                    {!expiryOk ? (
                      <p className="mb-1 text-xs text-error">
                        {t("addDocument.missingExpiry")}
                      </p>
                    ) : null}
                    <ExpiryDatePicker
                      value={item.expiryYmd}
                      onChange={(value) =>
                        updateItem(item.key, { expiryYmd: value })
                      }
                    />
                  </div>

                  <SecondaryButton onClick={() => removeItem(item.key)}>
                    {t("addDocument.removeRow")}
                  </SecondaryButton>
                </article>
              );
            })}
          </div>

          <PrimaryButton
            onClick={() => void confirmImport()}
            disabled={!canImport || importing}
          >
            {importing ? t("addDocument.importing") : t("addDocument.confirmImport")}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setItems([]);
              setError("");
              setStep("camera");
            }}
          >
            {t("addDocument.retake")}
          </SecondaryButton>
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