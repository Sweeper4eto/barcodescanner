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
import { startEnhancedAutoScan, toggleBarcodeTorch } from "@/lib/barcode-camera";
import { BarcodeReadConsensus, normalizeBarcode } from "@/lib/barcode";

type Props = {
  onScan: (barcode: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Start camera as soon as the component mounts (scan pages). */
  autoStart?: boolean;
  /** When false, camera scan fills the barcode field for manual edit before confirm. */
  submitOnScan?: boolean;
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

const SCAN_CONFIG: Html5QrcodeCameraScanConfig = {
  fps: 8,
  disableFlip: false,
};

const CAMERA_CACHE_KEY = "magazin-barcode-camera-id";

const CAMERA_ATTEMPTS: MediaTrackConstraints[] = [
  { facingMode: { exact: "environment" } },
  { facingMode: { ideal: "environment" } },
  { facingMode: "environment" },
  { facingMode: "user" },
  {},
];

const SCANNER_OPTIONS = {
  verbose: false,
  formatsToSupport: PRODUCT_BARCODE_FORMATS,
  useBarCodeDetectorIfSupported: true,
  experimentalFeatures: {
    useBarCodeDetectorIfSupported: true,
  },
} as const;

function cacheCameraId(cameraId: string): void {
  try {
    sessionStorage.setItem(CAMERA_CACHE_KEY, cameraId);
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

function readCachedCameraId(): string | null {
  try {
    return sessionStorage.getItem(CAMERA_CACHE_KEY);
  } catch {
    return null;
  }
}

function pickRearCamera(cameras: CameraDevice[]): string | undefined {
  const rear = cameras.find((camera) =>
    /back|rear|environment/i.test(camera.label),
  );
  return rear?.id ?? cameras[0]?.id;
}

async function safeStopScanner(scanner: Html5Qrcode | null | undefined): Promise<void> {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop().catch(() => undefined);
    }
  } catch {
    // html5-qrcode may throw synchronously if stop runs before start finishes
  }
}

async function resetScanner(scanner: Html5Qrcode): Promise<void> {
  await safeStopScanner(scanner);
}

async function startScanner(
  scanner: Html5Qrcode,
  fileDecoder: Html5Qrcode,
  containerId: string,
  onDecoded: (value: string) => void | Promise<void>,
): Promise<() => void> {
  let lastError: unknown;
  const consensus = new BarcodeReadConsensus();
  let stopEnhanced: () => void = () => {};

  const deliver = (accepted: string) => {
    void (async () => {
      stopEnhanced();
      try {
        scanner.pause(true);
      } catch {
        // Scanner may not be running yet while the camera is still starting.
      }
      try {
        await onDecoded(accepted);
      } catch {
        consensus.reset();
        try {
          scanner.resume();
        } catch {
          // ignore resume failures during camera startup
        }
        stopEnhanced = startEnhancedAutoScan(fileDecoder, containerId, consider);
      }
    })();
  };

  const consider = (decoded: string) => {
    const accepted = consensus.add(decoded);
    if (accepted) deliver(accepted);
  };

  const onScanSuccess = (decoded: string) => consider(decoded);

  const beginEnhancedScan = () => {
    stopEnhanced();
    stopEnhanced = startEnhancedAutoScan(fileDecoder, containerId, consider);
  };

  const cachedCameraId = readCachedCameraId();
  if (cachedCameraId) {
    try {
      await scanner.start(cachedCameraId, SCAN_CONFIG, onScanSuccess, () => undefined);
      beginEnhancedScan();
      return () => stopEnhanced();
    } catch (error) {
      lastError = error;
      await resetScanner(scanner);
      try {
        sessionStorage.removeItem(CAMERA_CACHE_KEY);
      } catch {
        // ignore
      }
    }
  }

  for (const camera of CAMERA_ATTEMPTS) {
    try {
      await scanner.start(camera, SCAN_CONFIG, onScanSuccess, () => undefined);
      beginEnhancedScan();
      return () => stopEnhanced();
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
        cacheCameraId(cameraId);
        beginEnhancedScan();
        return () => stopEnhanced();
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
):
  | "scanner.permissionDenied"
  | "scanner.insecureContext"
  | "scanner.noCamera"
  | "scanner.cameraBusy"
  | "scanner.cameraUnavailable" {
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
  if (
    name === "NotReadableError" ||
    message.includes("could not start video source") ||
    message.includes("trackstarterror") ||
    message.includes("device in use") ||
    message.includes("notreadableerror")
  ) {
    return "scanner.cameraBusy";
  }
  if (message.includes("requested device not found") || message.includes("no camera")) {
    return "scanner.noCamera";
  }
  return "scanner.cameraUnavailable";
}

export function BarcodeScanner({
  onScan,
  onCancel,
  autoStart = false,
  submitOnScan = false,
}: Props) {
  const { t } = useT();
  const elementId = useId().replace(/:/g, "");
  const fileDecoderId = `${elementId}-decoder`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileDecoderRef = useRef<Html5Qrcode | null>(null);
  const scanCleanupRef = useRef<(() => void) | null>(null);
  const onScanRef = useRef(onScan);
  const submitOnScanRef = useRef(submitOnScan);
  const handledRef = useRef(false);
  const abortedRef = useRef(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    submitOnScanRef.current = submitOnScan;
  }, [submitOnScan]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.isSecureContext) return;

    abortedRef.current = false;

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(elementId, SCANNER_OPTIONS);
    }
    if (!fileDecoderRef.current) {
      fileDecoderRef.current = new Html5Qrcode(fileDecoderId, SCANNER_OPTIONS);
    }

    const stopCamera = () => {
      abortedRef.current = true;
      scanCleanupRef.current?.();
      scanCleanupRef.current = null;
      void safeStopScanner(scannerRef.current);
    };

    const onPageHide = () => {
      stopCamera();
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      stopCamera();
      scannerRef.current = null;
      fileDecoderRef.current?.clear();
      fileDecoderRef.current = null;
    };
  }, [elementId, fileDecoderId]);

  const deliverBarcode = useCallback(async (value: string) => {
    const barcode = normalizeBarcode(value);
    if (!barcode) {
      return;
    }

    if (!submitOnScanRef.current) {
      setManual(barcode);
      handledRef.current = false;
      try {
        scannerRef.current?.resume();
      } catch {
        // Scanner may not be running yet while the camera is still starting.
      }
      return;
    }

    if (handledRef.current) return;
    handledRef.current = true;
    setManual(barcode);
    await onScanRef.current(barcode);
  }, []);

  const startCamera = useCallback(async () => {
    if (starting || scanning || abortedRef.current) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.insecureContext"));
      return;
    }

    handledRef.current = false;
    setStarting(true);
    setError("");
    setScanning(true);
    setTorchOn(false);
    scanCleanupRef.current?.();
    scanCleanupRef.current = null;

    try {
      if (scannerRef.current) {
        await resetScanner(scannerRef.current);
      } else {
        scannerRef.current = new Html5Qrcode(elementId, SCANNER_OPTIONS);
      }

      if (abortedRef.current) return;

      if (!fileDecoderRef.current) {
        fileDecoderRef.current = new Html5Qrcode(fileDecoderId, SCANNER_OPTIONS);
      }

      scanCleanupRef.current = await startScanner(
        scannerRef.current,
        fileDecoderRef.current,
        elementId,
        deliverBarcode,
      );

      if (abortedRef.current) {
        scanCleanupRef.current?.();
        scanCleanupRef.current = null;
        await resetScanner(scannerRef.current);
        setScanning(false);
        return;
      }

      try {
        const torch = scannerRef.current.getRunningTrackCameraCapabilities().torchFeature();
        setTorchAvailable(torch.isSupported());
      } catch {
        setTorchAvailable(false);
      }
    } catch (caught) {
      if (!abortedRef.current) {
        setScanning(false);
        setError(t(scannerErrorKey(caught)));
      }
    } finally {
      if (!abortedRef.current) {
        setStarting(false);
      }
    }
  }, [deliverBarcode, elementId, fileDecoderId, scanning, starting, t]);

  useEffect(() => {
    if (!autoStart) return;
    void startCamera();
    // Only auto-start once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const onTorchToggle = useCallback(async () => {
    if (!scannerRef.current) return;
    const next = !torchOn;
    const applied = await toggleBarcodeTorch(scannerRef.current, next);
    if (applied) setTorchOn(next);
  }, [torchOn]);

  async function confirmManual() {
    const barcode = normalizeBarcode(manual);
    if (!barcode) return;
    try {
      await onScanRef.current(barcode);
    } catch {
      // Scan handlers must not throw; guard the app shell if one does.
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={
          scanning
            ? "barcode-scanner-view overflow-hidden rounded-xl border border-card-border"
            : "h-0 overflow-hidden"
        }
      >
        <div id={elementId} className="w-full max-w-full" />
      </div>
      <div id={fileDecoderId} className="hidden" aria-hidden />
      {scanning ? (
        <p className="text-sm text-muted">
          {starting ? t("scanner.starting") : t("scanner.tips")}
        </p>
      ) : null}
      {!scanning ? (
        <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
          {starting ? t("scanner.starting") : t("scanner.startCamera")}
        </PrimaryButton>
      ) : torchAvailable ? (
        <SecondaryButton onClick={() => void onTorchToggle()}>
          {torchOn ? t("scanner.torchOff") : t("scanner.torchOn")}
        </SecondaryButton>
      ) : null}
      {error ? <p className="text-sm text-warning-fg">{error}</p> : null}
      <label className="block text-sm font-medium text-foreground">
        {t("common.barcode")}
        <input
          data-testid="barcode-manual-input"
          className="mt-1 w-full min-w-0 rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
          placeholder={t("scanner.manualPlaceholder")}
          value={manual}
          onChange={(event) => setManual(event.target.value)}
        />
      </label>
      <button
        type="button"
        data-testid="scanner-confirm-barcode"
        className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-fg disabled:opacity-50"
        disabled={!normalizeBarcode(manual)}
        onClick={() => void confirmManual()}
      >
        {t("scanner.confirmBarcode")}
      </button>
      {onCancel ? <SecondaryButton onClick={onCancel}>{t("common.cancel")}</SecondaryButton> : null}
    </div>
  );
}
