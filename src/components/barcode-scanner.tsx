"use client";

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type CameraDevice,
  type Html5QrcodeCameraScanConfig,
} from "html5-qrcode";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import {
  optimizeBarcodeCamera,
  refocusBarcodeCamera,
  toggleBarcodeTorch,
} from "@/lib/barcode-camera";
import { BarcodeReadConsensus } from "@/lib/barcode";

type Props = {
  onScan: (barcode: string) => void | Promise<void>;
  onCancel?: () => void;
};

const PRODUCT_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
];

const BARCODE_VIDEO_CONSTRAINTS = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920, min: 640 },
  height: { ideal: 1080, min: 480 },
  focusMode: { ideal: "continuous" },
  advanced: [{ focusMode: "continuous" }],
} as unknown as MediaTrackConstraints;

const SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  fps: 10,
  disableFlip: false,
  aspectRatio: 1.7777778,
  qrbox: (width, height) => {
    const base = Math.min(width, height);
    return {
      width: Math.floor(base * 0.92),
      height: Math.max(Math.floor(base * 0.3), 72),
    };
  },
  videoConstraints: BARCODE_VIDEO_CONSTRAINTS,
};

const CAMERA_ATTEMPTS: MediaTrackConstraints[] = [
  BARCODE_VIDEO_CONSTRAINTS,
  { facingMode: { ideal: "environment" } },
  { facingMode: "environment" },
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
  const consensus = new BarcodeReadConsensus(3);

  const onScanSuccess = (decoded: string) => {
    const accepted = consensus.add(decoded);
    if (!accepted) return;

    void (async () => {
      scanner.pause(true);
      try {
        await onDecoded(accepted);
      } catch {
        consensus.reset();
        scanner.resume();
      }
    })();
  };

  for (const camera of CAMERA_ATTEMPTS) {
    try {
      await scanner.start(camera, SCAN_CONFIG, onScanSuccess, () => undefined);
      await optimizeBarcodeCamera(scanner);
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
        await optimizeBarcodeCamera(scanner);
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
  const [refocusing, setRefocusing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

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
    setTorchOn(false);

    try {
      if (scannerRef.current) {
        await resetScanner(scannerRef.current);
      } else {
        scannerRef.current = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: PRODUCT_BARCODE_FORMATS,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
      }

      await startScanner(scannerRef.current, async (value) => {
        if (handledRef.current) return;
        handledRef.current = true;
        if (!value) {
          handledRef.current = false;
          throw new Error("EMPTY_BARCODE");
        }
        await onScanRef.current(value);
      });

      try {
        const torch = scannerRef.current.getRunningTrackCameraCapabilities().torchFeature();
        setTorchAvailable(torch.isSupported());
      } catch {
        setTorchAvailable(false);
      }
    } catch (caught) {
      setScanning(false);
      setError(t(scannerErrorKey(caught)));
    } finally {
      setStarting(false);
    }
  }, [elementId, scanning, starting, t]);

  const onRefocus = useCallback(async () => {
    if (!scannerRef.current || refocusing) return;
    setRefocusing(true);
    try {
      await refocusBarcodeCamera(scannerRef.current);
    } finally {
      setRefocusing(false);
    }
  }, [refocusing]);

  const onTorchToggle = useCallback(async () => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    const applied = await toggleBarcodeTorch(scannerRef.current, next);
    if (applied) setTorchOn(next);
  }, [torchOn]);

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
      {scanning ? (
        <p className="text-sm text-muted">{t("scanner.tips")}</p>
      ) : null}
      {!scanning ? (
        <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
          {starting ? t("scanner.starting") : t("scanner.startCamera")}
        </PrimaryButton>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={() => void onRefocus()}>
            {refocusing ? t("scanner.refocusing") : t("scanner.refocus")}
          </SecondaryButton>
          {torchAvailable ? (
            <SecondaryButton onClick={() => void onTorchToggle()}>
              {torchOn ? t("scanner.torchOff") : t("scanner.torchOn")}
            </SecondaryButton>
          ) : (
            <div />
          )}
        </div>
      )}
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
