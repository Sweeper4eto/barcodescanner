"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { QuantityPicker } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { goBackOrApp, navigateApp } from "@/lib/app-navigation";
import { normalizeBarcode } from "@/lib/barcode";
import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { lookupProductByBarcode } from "@/lib/scan-barcode-lookup";
import { useWizardStep } from "@/lib/wizard-history";

type ScanStep = "scan" | "missing" | "name" | "qty" | "date";

export function ScanFlow() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const urlBarcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  const { t } = useT();
  const [barcode, setBarcode] = useState("");
  const { step, goToStep, goBack } = useWizardStep<ScanStep>({
    initialStep: "scan",
    getPreviousStep: (current) => {
      switch (current) {
        case "date":
          return "qty";
        case "qty":
          return product ? "scan" : "name";
        case "name":
        case "missing":
          return "scan";
        default:
          return null;
      }
    },
  });
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    imagePath: string | null;
    barcode: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [articul, setArticul] = useState("");
  const [entryImagePath, setEntryImagePath] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [expiryDate, setExpiryDate] = useState("");
  const [message, setMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const beginKnownProduct = useCallback(
    (next: {
      id: string;
      name: string;
      imagePath: string | null;
      barcode: string;
    }) => {
      setProduct(next);
      setBarcode(next.barcode);
      setName(next.name);
      setEntryImagePath(null);
      setCapturingPhoto(false);
      setMessage("");
      goToStep("qty");
    },
    [goToStep],
  );

  const beginManualEntry = useCallback(
    (optionalBarcode: string) => {
      setProduct(null);
      setBarcode(optionalBarcode);
      setName("");
      setEntryImagePath(null);
      setCapturingPhoto(false);
      setMessage("");
      goToStep("name");
    },
    [goToStep],
  );

  const lookupBarcode = useCallback(
    async (value: string) => {
      setLookingUp(true);
      setMessage("");

      try {
        const result = await lookupProductByBarcode(value);
        switch (result.status) {
          case "unauthorized":
            navigateApp("/login");
            return;
          case "error":
            setMessage(
              result.message === "NETWORK_ERROR"
                ? t("errors.networkError")
                : t("errors.lookupFailed"),
            );
            return;
          case "missing":
            setBarcode(result.barcode);
            setProduct(null);
            goToStep("missing");
            return;
          case "found":
            beginKnownProduct(result.product);
            return;
        }
      } finally {
        setLookingUp(false);
      }
    },
    [beginKnownProduct, goToStep, t],
  );

  useEffect(() => {
    if (!urlBarcode) return;
    void lookupBarcode(urlBarcode);
  }, [lookupBarcode, urlBarcode]);

  async function submitInventory() {
    if (!expiryDate) return;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) return;

    const resolvedName = (product?.name || name).trim();

    setSaving(true);
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        storeId,
        quantity: qty,
        expiryDate: new Date(expiryDate).toISOString(),
        articul: articul.trim() || undefined,
      };

      if (product?.id) {
        body.productId = product.id;
        body.barcode = normalizeBarcode(barcode) || product.barcode;
      } else {
        body.name = resolvedName;
        const normalized = normalizeBarcode(barcode);
        if (normalized) body.barcode = normalized;
        if (entryImagePath) body.imagePath = entryImagePath;
      }

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setMessage(data?.error ?? t("errors.saveFailed"));
        return;
      }
      navigateApp(
        storeId
          ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
          : "/app",
      );
    } finally {
      setSaving(false);
    }
  }

  const displayName =
    (product?.name || name).trim() || t("common.noName");
  const displayBarcode = normalizeBarcode(barcode) || product?.barcode || "";
  const showBarcode = displayBarcode && !isAdhocBarcode(displayBarcode);
  const previewImage = entryImagePath || product?.imagePath || null;

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
      {mounted ? (
        <span data-testid="scan-flow-ready" className="sr-only" aria-hidden />
      ) : null}
      <MobilePageHeader title={t("scan.title")} />

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          {lookingUp ? (
            <p className="mb-4 text-sm text-muted">{t("scan.lookingUp")}</p>
          ) : null}
          {message ? <p className="mb-4 text-sm text-error">{message}</p> : null}
          <BarcodeScanner
            autoStart={!urlBarcode}
            onScan={lookupBarcode}
            onSkipWithoutBarcode={() => beginManualEntry("")}
            onCancel={() =>
              goBackOrApp(
                storeId
                  ? `/app/scan?storeId=${encodeURIComponent(storeId)}`
                  : "/app",
              )
            }
          />
        </div>
      ) : null}

      {step === "missing" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p>{t("scan.productMissing")}</p>
          {barcode ? (
            <p className="font-mono text-sm text-muted">{barcode}</p>
          ) : null}
          <PrimaryButton
            onClick={() => {
              navigateApp(
                `/app/add-product?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(barcode)}`,
              );
            }}
          >
            {t("common.yes")}
          </PrimaryButton>
          <SecondaryButton onClick={() => beginManualEntry(barcode)}>
            {t("common.no")}
          </SecondaryButton>
        </div>
      ) : null}

      {step === "name" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {capturingPhoto ? (
            <CameraCapture
              onCapture={(dataUrl) => {
                void (async () => {
                  setUploadingPhoto(true);
                  setMessage("");
                  try {
                    const path = await uploadImage(dataUrl);
                    setEntryImagePath(path);
                    setCapturingPhoto(false);
                  } catch {
                    setMessage(t("errors.uploadFailed"));
                  } finally {
                    setUploadingPhoto(false);
                  }
                })();
              }}
              onCancel={() => setCapturingPhoto(false)}
            />
          ) : (
            <>
              <ProductImage
                src={entryImagePath}
                alt=""
                className="mx-auto h-32 w-32 rounded-xl object-cover"
                placeholderClassName="mx-auto h-32 w-32 rounded-xl"
              />
              <PrimaryButton
                onClick={() => setCapturingPhoto(true)}
                disabled={uploadingPhoto}
              >
                {entryImagePath
                  ? t("expiry.changePicture")
                  : t("scan.takePhotoOptional")}
              </PrimaryButton>
            </>
          )}
          {uploadingPhoto ? (
            <p className="text-xs text-muted">{t("scanner.starting")}</p>
          ) : null}
          {barcode && !isAdhocBarcode(barcode) ? (
            <label className="block text-sm font-medium text-foreground">
              {t("common.barcode")}
              <input
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-foreground">
            {t("scan.enterName")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t("common.articul")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={articul}
              onChange={(event) => setArticul(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted">{t("scan.skipPhotoHint")}</p>
          {message ? <p className="text-sm text-error">{message}</p> : null}
          <PrimaryButton
            onClick={() => goToStep("qty")}
            disabled={capturingPhoto || uploadingPhoto}
          >
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton onClick={goBack}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}

      {step === "qty" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <ProductImage
            src={previewImage}
            alt={displayName}
            className="mx-auto max-h-52 rounded-xl object-cover"
            placeholderClassName="mx-auto h-40 w-40 rounded-xl"
          />
          <p className="font-medium">{displayName}</p>
          {showBarcode ? (
            <label className="block text-sm font-medium text-foreground">
              {t("common.barcode")}
              <input
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
                value={displayBarcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-foreground">
            {t("common.articul")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={articul}
              onChange={(event) => setArticul(event.target.value)}
            />
          </label>
          <QuantityPicker value={quantity} onChange={setQuantity} />
          <PrimaryButton
            onClick={() => goToStep("date")}
            disabled={!quantity || Number(quantity) < 1}
          >
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigateApp("/app")}>
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      ) : null}

      {step === "date" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <ProductImage
            src={previewImage}
            alt={displayName}
            className="mx-auto max-h-52 w-full rounded-xl border border-card-border object-contain"
            placeholderClassName="mx-auto h-40 w-40 rounded-xl"
          />
          <p className="font-medium">{displayName}</p>
          {showBarcode ? (
            <p className="font-mono text-xs text-muted">{displayBarcode}</p>
          ) : null}
          {articul.trim() ? (
            <p className="text-sm text-muted">
              {t("common.articul")}: {articul.trim()}
            </p>
          ) : null}
          <QuantityPicker
            value={quantity}
            onChange={setQuantity}
            startWithGridOpen={false}
          />
          <ExpiryDatePicker value={expiryDate} onChange={setExpiryDate} />
          {message ? <p className="text-sm text-error">{message}</p> : null}
          <PrimaryButton
            onClick={() => void submitInventory()}
            disabled={!expiryDate || saving}
          >
            {t("scan.enter")}
          </PrimaryButton>
          <SecondaryButton onClick={goBack}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}
