"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { normalizeBarcode } from "@/lib/barcode";
import { useWizardHistory } from "@/lib/wizard-history";

function ScanFlow() {
  const router = useRouter();
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const pendingBarcode = searchParams.get("barcode") ?? "";
  const autoLookupDone = useRef(false);
  const [barcode, setBarcode] = useState("");
  const [step, setStep] = useState<"scan" | "qty" | "date" | "missing">("scan");
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
  const { goToStep } = useWizardHistory({
    step,
    initialStep: "scan",
    setStep,
  });

  const lookupBarcode = useCallback(
    async (value: string) => {
      const normalized = normalizeBarcode(value);
      if (!normalized) return;

      setBarcode(normalized);
      setMessage("");
      setLookingUp(true);

      try {
        const response = await fetch(
          `/api/products?barcode=${encodeURIComponent(normalized)}`,
          { credentials: "same-origin" },
        );

        if (response.status === 401) {
          router.push("/login");
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          product?: {
            id: string;
            name: string;
            imagePath: string | null;
            barcode: string;
          };
          error?: string;
        } | null;

        if (!response.ok || !data) {
          setMessage(data?.error ?? t("errors.lookupFailed"));
          throw new Error("LOOKUP_FAILED");
        }

        if (!data.product) {
          goToStep("missing");
          return;
        }

        setProduct(data.product);
        goToStep("qty");
      } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
          throw error;
        }
        setMessage(t("errors.networkError"));
        throw error;
      } finally {
        setLookingUp(false);
      }
    },
    [goToStep, router, t],
  );

  useEffect(() => {
    if (!pendingBarcode || autoLookupDone.current) return;
    autoLookupDone.current = true;
    void lookupBarcode(pendingBarcode);
  }, [lookupBarcode, pendingBarcode]);

  async function submitInventory() {
    if (!product || !expiryDate) return;
    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        barcode: product.barcode,
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
    router.replace("/app");
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
      <MobilePageHeader
        title={t("scan.title")}
        action={
          <Link href="/app" className="text-sm text-accent">
            {t("common.cancel")}
          </Link>
        }
      />

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          {lookingUp ? (
            <p className="mb-4 text-sm text-muted">{t("scan.lookingUp")}</p>
          ) : null}
          {message ? <p className="mb-4 text-sm text-error">{message}</p> : null}
          <BarcodeScanner
            autoStart
            onScan={lookupBarcode}
            onCancel={() => router.push("/app")}
          />
        </div>
      ) : null}

      {step === "missing" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p>{t("scan.productMissing")}</p>
          <PrimaryButton
            onClick={() =>
              router.push(`/app/add-product?storeId=${storeId}&barcode=${encodeURIComponent(barcode)}`)
            }
          >
            {t("common.yes")}
          </PrimaryButton>
          <SecondaryButton onClick={() => goToStep("scan")}>{t("common.no")}</SecondaryButton>
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
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {Array.from({ length: 20 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                className={`min-w-0 rounded-lg border border-input-border bg-card px-1 py-3 text-sm text-foreground sm:px-2 ${quantity === String(value) ? "border-primary bg-selected" : "border-card-border"}`}
                onClick={() => setQuantity(String(value))}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
            inputMode="numeric"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value.replace(/[^\d]/g, ""))
            }
          />
          <PrimaryButton onClick={() => goToStep("date")} disabled={!quantity || Number(quantity) < 1}>
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton onClick={() => router.push("/app")}>{t("common.cancel")}</SecondaryButton>
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
          <p className="text-sm text-muted">
            {t("common.quantity")}: {quantity}
          </p>
          <ExpiryDatePicker value={expiryDate} onChange={setExpiryDate} />
          {message ? <p className="text-sm text-error">{message}</p> : null}
          <PrimaryButton onClick={() => void submitInventory()} disabled={!expiryDate}>
            {t("scan.enter")}
          </PrimaryButton>
          <SecondaryButton onClick={() => router.push("/app")}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanFlow />
    </Suspense>
  );
}
