"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { useT } from "@/components/i18n-provider";

function AddProductFlow() {
  const router = useRouter();
  const { t } = useT();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const initialBarcode = searchParams.get("barcode") ?? "";
  const [step, setStep] = useState<"scan" | "name" | "photo" | "confirm">(
    initialBarcode ? "name" : "scan",
  );
  const [barcode, setBarcode] = useState(initialBarcode);
  const [name, setName] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const checkBarcode = useCallback(async (value: string) => {
    const response = await fetch(`/api/products?barcode=${encodeURIComponent(value)}`);
    const data = await response.json();
    if (data.product) {
      setError(t("errors.productExistsGlobal"));
      return;
    }
    setBarcode(value);
    setError("");
    setStep("name");
  }, [t]);

  async function onPhotoCapture(dataUrl: string) {
    setPhotoPreview(dataUrl);
    setImagePath("");
    setError("");
    setStep("confirm");
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
    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode, name, imagePath: imagePath || undefined }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? t("errors.saveFailed"));
      return;
    }
    router.push(`/app/scan?storeId=${storeId}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("addProduct.title")}</h1>
        <Link href="/app" className="text-sm text-accent">
          {t("common.cancel")}
        </Link>
      </div>

      {step === "scan" ? (
        <div className="rounded-2xl border border-card-border p-4">
          <BarcodeScanner
            onScan={(value) => void checkBarcode(value)}
            onCancel={() => router.push("/app")}
          />
          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
        </div>
      ) : null}

      {step === "name" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">
            {t("common.barcode")}: {barcode}
          </p>
          <input
            className="w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
            placeholder={t("addProduct.productName")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <PrimaryButton onClick={() => setStep("photo")} disabled={!name.trim()}>
            {t("common.next")}
          </PrimaryButton>
          <SecondaryButton onClick={() => router.push("/app")}>{t("common.cancel")}</SecondaryButton>
        </div>
      ) : null}

      {step === "photo" ? (
        <div className="space-y-4 rounded-2xl border border-card-border p-4">
          <p className="text-sm text-muted">{t("addProduct.takePhoto")}</p>
          {uploading ? <p className="text-sm text-muted">{t("addProduct.uploading")}</p> : null}
          <CameraCapture
            onCapture={(dataUrl) => void onPhotoCapture(dataUrl)}
            onCancel={() => router.push("/app")}
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
          <SecondaryButton onClick={() => router.push("/app")}>{t("common.cancel")}</SecondaryButton>
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
