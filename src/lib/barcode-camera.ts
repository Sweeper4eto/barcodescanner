import type { Html5Qrcode } from "html5-qrcode";
import { isPlausibleBarcode, normalizeBarcode } from "@/lib/barcode";

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

/** Boost contrast so barcodes show through glass, glare, and pale labels. */
function enhanceBarcodeImage(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const contrast = 1.55;
  const brightness = 8;
  const offset = 128 * (1 - contrast);

  for (let index = 0; index < data.length; index += 4) {
    data[index] = clamp(data[index] * contrast + offset + brightness);
    data[index + 1] = clamp(data[index + 1] * contrast + offset + brightness);
    data[index + 2] = clamp(data[index + 2] * contrast + offset + brightness);
  }

  context.putImageData(imageData, 0, 0);
}

function findScannerVideo(containerId: string): HTMLVideoElement | null {
  const container = document.getElementById(containerId);
  return container?.querySelector("video") ?? null;
}

export async function refocusBarcodeCamera(scanner: Html5Qrcode): Promise<void> {
  try {
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: "single-shot" }],
    } as unknown as MediaTrackConstraints);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await scanner.applyVideoConstraints({
      advanced: [{ focusMode: "continuous" }],
      focusMode: { ideal: "continuous" },
    } as unknown as MediaTrackConstraints);
  } catch {
    // Focus modes are optional across devices.
  }
}

export async function toggleBarcodeTorch(
  scanner: Html5Qrcode,
  enabled: boolean,
): Promise<boolean> {
  try {
    const torch = scanner.getRunningTrackCameraCapabilities().torchFeature();
    if (!torch.isSupported()) return false;
    await torch.apply(enabled);
    return true;
  } catch {
    return false;
  }
}

export async function decodeEnhancedVideoFrame(
  fileDecoder: Html5Qrcode,
  containerId: string,
): Promise<string | null> {
  const video = findScannerVideo(containerId);
  if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  enhanceBarcodeImage(context, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.95);
  });
  if (!blob) return null;

  const file = new File([blob], "barcode-frame.jpg", { type: "image/jpeg" });

  try {
    const decoded = await fileDecoder.scanFile(file, false);
    const code = normalizeBarcode(decoded);
    return isPlausibleBarcode(code) ? code : null;
  } catch {
    return null;
  }
}

const ENHANCED_SCAN_INTERVAL_MS = 450;

/** Periodically decode contrast-boosted frames for glass, glare, and curved labels. */
export function startEnhancedAutoScan(
  fileDecoder: Html5Qrcode,
  containerId: string,
  onCandidate: (code: string) => void,
): () => void {
  let busy = false;

  const interval = setInterval(() => {
    if (busy) return;
    busy = true;
    void decodeEnhancedVideoFrame(fileDecoder, containerId)
      .then((code) => {
        if (code) onCandidate(code);
      })
      .finally(() => {
        busy = false;
      });
  }, ENHANCED_SCAN_INTERVAL_MS);

  return () => clearInterval(interval);
}
