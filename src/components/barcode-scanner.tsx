"use client";

import { Html5Qrcode, type CameraDevice } from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type Props = {
  onScan: (barcode: string) => void | Promise<void>;
  onCancel?: () => void;
};

const SCAN_CONFIG = {
  fps: 15,
  qrbox: (width: number, height: number) => {
    const edge = Math.min(width, height) * 0.75;
    return { width: Math.floor(edge), height: Math.floor(edge * 0.55) };
  },
};

const FAST_CAMERA_ATTEMPTS: MediaTrackConstraints[] = [
  { facingMode: "environment" },
  { facingMode: { ideal: "environment" } },
  { facingMode: "user" },
];

function pickRearCamera(cameras: CameraDevice[]): string | undefined {
  const rear = cameras.find((camera) =>
    /back|rear|environment/i.test(camera.label),
  );
  return rear?.id ?? cameras[0]?.id;
}

async function resetScanner(scanner: Html5Qrcode): Promise<void> {
  if (scanner.isScanning) {
    await scanner.stop().catch(() => undefined);
  }
}

async function startScanner(
  scanner: Html5Qrcode,
  onDecoded: (value: string) => void | Promise<void>,
): Promise<void> {
  let lastError: unknown;

  const onScanSuccess = (decoded: string) => {
    void (async () => {
      scanner.pause(true);
      try {
        await onDecoded(decoded);
      } catch {
        scanner.resume();
      }
    })();
  };

  for (const camera of FAST_CAMERA_ATTEMPTS) {
    try {
      await scanner.start(camera, SCAN_CONFIG, onScanSuccess, () => undefined);
      return;
    } catch (error) {
      lastError = error;
      await resetScanner(scanner);
    }
  }

  try {
    const cameras = await Html5Qrcode.getCameras();
    const rearId = cameras.length ? pickRearCamera(cameras) : undefined;
    const cameraIds = rearId
      ? [rearId, ...cameras.filter((camera) => camera.id !== rearId).map((c) => c.id)]
      : cameras.map((camera) => camera.id);

    for (const cameraId of cameraIds) {
      try {
        await scanner.start(cameraId, SCAN_CONFIG, onScanSuccess, () => undefined);
        return;
      } catch (error) {
        lastError = error;
        await resetScanner(scanner);
      }
    }
  } catch {
    // getCameras can fail before permission on some browsers
  }

  throw lastError ?? new Error("CAMERA_UNAVAILABLE");
}

function scannerErrorKey(
  error: unknown,
): "scanner.permissionDenied" | "scanner.insecureContext" | "scanner.noCamera" | "scanner.cameraUnavailable" {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "scanner.insecureContext";
  }

  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    name === "NotAllowedError" ||
    message.includes("permission") ||
    message.includes("camera_permission_failed")
  ) {
    return "scanner.permissionDenied";
  }
  if (
    name === "NotFoundError" &&
    !message.includes("element") &&
    !message.includes("scanner_element")
  ) {
    return "scanner.noCamera";
  }
  if (message.includes("requested device not found") || message.includes("no camera")) {
    return "scanner.noCamera";
  }
  return "scanner.cameraUnavailable";
}

export function BarcodeScanner({ onScan, onCancel }: Props) {
  const { t } = useT();
  const elementId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const handledRef = useRef(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current = null;
    };
  }, []);

  const startCamera = useCallback(async () => {
    if (starting || scanning) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.insecureContext"));
      return;
    }

    handledRef.current = false;
    setStarting(true);
    setError("");
    setScanning(true);

    try {
      if (scannerRef.current) {
        await resetScanner(scannerRef.current);
      } else {
        scannerRef.current = new Html5Qrcode(elementId, { verbose: false });
      }

      await startScanner(scannerRef.current, async (value) => {
        if (handledRef.current) return;
        handledRef.current = true;
        const barcode = value.trim();
        if (!barcode) {
          handledRef.current = false;
          throw new Error("EMPTY_BARCODE");
        }
        await onScanRef.current(barcode);
      });
    } catch (caught) {
      setScanning(false);
      setError(t(scannerErrorKey(caught)));
    } finally {
      setStarting(false);
    }
  }, [elementId, scanning, starting, t]);

  return (
    <div className="space-y-4">
      <div
        className={
          scanning
            ? "overflow-hidden rounded-xl border border-card-border"
            : "h-0 overflow-hidden"
        }
      >
        <div id={elementId} />
      </div>
      {!scanning ? (
        <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
          {starting ? t("scanner.starting") : t("scanner.startCamera")}
        </PrimaryButton>
      ) : null}
      {error ? <p className="text-sm text-warning-fg">{error}</p> : null}
      <input
        className="w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
        placeholder={t("scanner.manualPlaceholder")}
        value={manual}
        onChange={(event) => setManual(event.target.value)}
      />
      <button
        type="button"
        className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-fg"
        onClick={() => {
          const barcode = manual.trim();
          if (barcode) {
            void onScan(barcode);
          }
        }}
      >
        {t("scanner.confirmBarcode")}
      </button>
      {onCancel ? <SecondaryButton onClick={onCancel}>{t("common.cancel")}</SecondaryButton> : null}
    </div>
  );
}
