"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { QuantityPicker } from "@/components/quantity-picker";
import { useT } from "@/components/i18n-provider";
import { goBackOrApp, navigateApp } from "@/lib/app-navigation";
import { normalizeBarcode } from "@/lib/barcode";
import { lookupProductByBarcode } from "@/lib/scan-barcode-lookup";
import { applyLookupResult } from "@/lib/scan-lookup-result";
import { useWizardStep } from "@/lib/wizard-history";

type ScanStep = "scan" | "qty" | "date" | "missing";

function getPreviousScanStep(step: ScanStep): ScanStep | null {
  switch (step) {
    case "date":
      return "qty";
    case "qty":
    case "missing":
      return "scan";
    default:
      return null;
  }
}

export function ScanFlow() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const urlBarcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  const { t } = useT();
  const [barcode, setBarcode] = useState("");
  const { step, goToStep, goBack } = useWizardStep<ScanStep>({
    initialStep: "scan",
    getPreviousStep: getPreviousScanStep,
  });
  const [product, setProduct] = useState<{
    id: string;
    name: string;
    imagePath: string | null;
    barcode: string;
  } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [expiryDate, setExpiryDate] = useState("");
  const [message, setMessage] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lookupBarcode = useCallback(
    async (value: string) => {
      setLookingUp(true);
      setMessage("");

      try {
        const result = await lookupProductByBarcode(value);
        applyLookupResult(result, {
          setMessage,
          setBarcode,
          setProduct,
          goToStep,
          t,
        });
      } finally {
        setLookingUp(false);
      }
    },
    [goToStep, t],
  );

  useEffect(() => {
    if (!urlBarcode) return;
    void lookupBarcode(urlBarcode);
  }, [lookupBarcode, urlBarcode]);

  async function submitInventory() {
    if (!product || !expiryDate) return;
    const resolvedBarcode = normalizeBarcode(barcode) || product.barcode;
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        barcode: resolvedBarcode,
        productId: product.id,
        quantity: Number(quantity),
        expiryDate: new Date(expiryDate).toISOString(),
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      setMessage(data.error ?? t("errors.saveFailed"));
      return;
    }
    navigateApp(storeId ? `/app/expiry?storeId=${encodeURIComponent(storeId)}` : "/app");
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
      {mounted ? <span data-testid="scan-flow-ready" className="sr-only" aria-hidden /> : null}
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
            onCancel={() => goBackOrApp(storeId ? `/app/scan?storeId=${encodeURIComponent(storeId)}` : "/app")}
          />
        </div>
      ) : null}

      {step === "missing" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p>{t("scan.productMissing")}</p>
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <PrimaryButton
            onClick={() => {
              navigateApp(
                `/app/add-product?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(barcode)}`,
              );
            }}
          >
            {t("common.yes")}
          </PrimaryButton>
          <SecondaryButton onClick={goBack}>{t("common.no")}</SecondaryButton>
        </div>
      ) : null}

      {step === "qty" && product ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {product.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imagePath}
              alt={product.name}
              className="mx-auto max-h-52 rounded-xl object-cover"
            />
          ) : null}
          <p className="font-medium">{product.name}</p>
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <QuantityPicker value={quantity} onChange={setQuantity} />
          <PrimaryButton onClick={() => goToStep("date")} disabled={!quantity || Number(quantity) < 1}>
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigateApp("/app")}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}

      {step === "date" && product ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {product.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imagePath}
              alt={product.name}
              className="mx-auto max-h-52 w-full rounded-xl border border-card-border object-contain"
            />
          ) : null}
          <p className="font-medium">{product.name}</p>
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <QuantityPicker
            value={quantity}
            onChange={setQuantity}
            startWithGridOpen={false}
          />
          <ExpiryDatePicker value={expiryDate} onChange={setExpiryDate} />
          {message ? <p className="text-sm text-error">{message}</p> : null}
          <PrimaryButton onClick={() => void submitInventory()} disabled={!expiryDate || !quantity || Number(quantity) < 1}>
            {t("scan.enter")}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigateApp("/app")}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}
