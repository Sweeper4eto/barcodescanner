"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { normalizeBarcode } from "@/lib/barcode";
import { useWizardStep } from "@/lib/wizard-history";

type AddProductStep = "scan" | "name" | "photo" | "confirm";

function getPreviousAddProductStep(
  step: AddProductStep,
  initialBarcode: string,
): AddProductStep | null {
  switch (step) {
    case "confirm":
      return "photo";
    case "photo":
      return "name";
    case "name":
      return initialBarcode ? null : "scan";
    default:
      return null;
  }
}

function AddProductFlow() {
  const router = useRouter();
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const initialBarcode = normalizeBarcode(searchParams.get("barcode") ?? "");
  const initialStep: AddProductStep = initialBarcode ? "name" : "scan";
  const { step, goToStep, goBack } = useWizardStep<AddProductStep>({
    initialStep,
    getPreviousStep: (current) => getPreviousAddProductStep(current, initialBarcode),
  });
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const checkBarcode = useCallback(async (value: string) => {
    const normalized = normalizeBarcode(value);
    if (!normalized) return;

    const response = await fetch(`/api/products?barcode=${encodeURIComponent(normalized)}`);
    const data = await response.json();
    if (data.product) {
      setError(t("errors.productExistsGlobal"));
      return;
    }
    setBarcode(normalized);
    setError("");
    goToStep("name");
  }, [goToStep, t]);

  async function onPhotoCapture(dataUrl: string) {
    setPhotoPreview(dataUrl);
    setImagePath("");
    setError("");
    goToStep("confirm");
    setUploading(true);

    try {
      const path = await uploadImage(dataUrl);
      setImagePath(path);
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : t("errors.uploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  }

  const confirmPhotoSrc = photoPreview || imagePath;

  async function saveProduct() {
    const normalizedBarcode = normalizeBarcode(barcode);
    if (!normalizedBarcode) return;
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode: normalizedBarcode, name, imagePath: imagePath || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? t("errors.saveFailed"));
      return;
    }
    window.location.replace(
      `/app/scan?storeId=${encodeURIComponent(storeId)}&barcode=${encodeURIComponent(data.product.barcode)}`,
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg px-4 py-6">
      <MobilePageHeader title={t("addProduct.title")} />

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          <BarcodeScanner
            autoStart
            onScan={(value) => void checkBarcode(value)}
            onCancel={() => router.back()}
          />
          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
        </div>
      ) : null}

      {step === "name" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <input
            className="w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
            placeholder={t("addProduct.productName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <PrimaryButton onClick={() => goToStep("photo")} disabled={!name.trim()}>
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => {
              if (initialBarcode) {
                router.back();
                return;
              }
              goBack();
            }}
          >
            {t("common.cancel")}
          </SecondaryButton>
        </div>
      ) : null}

      {step === "photo" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">{t("addProduct.takePhoto")}</p>
          {uploading ? <p className="text-sm text-muted">{t("addProduct.uploading")}</p> : null}
          <CameraCapture
            onCapture={(dataUrl) => void onPhotoCapture(dataUrl)}
            onCancel={goBack}
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          {confirmPhotoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={confirmPhotoSrc}
              alt={name}
              className="mx-auto max-h-64 w-full rounded-xl border border-card-border object-contain"
            />
          ) : null}
          {uploading ? (
            <p className="text-sm text-muted">{t("addProduct.uploading")}</p>
          ) : null}
          <p className="text-lg font-medium">{name}</p>
          <p className="text-sm text-muted">
            {t("common.barcode")}: {barcode}
          </p>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <PrimaryButton
            onClick={() => void saveProduct()}
            disabled={uploading || !imagePath}
          >
            {t("scan.enter")}
          </PrimaryButton>
          <SecondaryButton onClick={goBack}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense>
      <AddProductFlow />
    </Suspense>
  );
}
