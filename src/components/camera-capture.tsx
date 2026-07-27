"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type Props = {
  onCapture: (dataUrl: string) => void;
  /**
   * Called instead of `onCapture` when the user selects more than one file
   * at once from the gallery (requires `allowFileUpload` + `allowMultipleFiles`).
   * Bypasses the single-photo preview step since reviewing many photos one
   * by one before continuing isn't useful for a multi-page document.
   */
  onMultipleCapture?: (dataUrls: string[]) => void;
  onCancel?: () => void;
  autoStart?: boolean;
  allowFileUpload?: boolean;
  /** Allow selecting multiple images at once from the gallery picker. */
  allowMultipleFiles?: boolean;
  /**
   * Cap the live/preview image height so Capture / Upload / Cancel stay on
   * screen (needed on Add document where the phone camera is otherwise huge).
   */
  compact?: boolean;
};

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ may report as Mac with touch
  return (
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/** Safari/iOS usually lacks ImageCapture — stills are only video frames unless we use the native camera. */
function supportsFullStillCapture(): boolean {
  return typeof ImageCapture !== "undefined";
}

function prefersNativeCameraCapture(): boolean {
  return isIosLike() && !supportsFullStillCapture();
}

function isAcceptedImageFile(file: File): boolean {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  // iOS sometimes omits MIME type; fall back to extension.
  if (!file.type && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) {
    return true;
  }
  return false;
}

function cameraErrorKey(
  error: unknown,
): "scanner.permissionDenied" | "scanner.insecureContext" | "scanner.noCamera" | "camera.unavailable" {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "scanner.insecureContext";
  }

  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (name === "NotAllowedError" || message.includes("permission")) {
    return "scanner.permissionDenied";
  }
  if (name === "NotFoundError" || message.includes("not found")) {
    return "scanner.noCamera";
  }
  return "camera.unavailable";
}

async function openCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("NO_MEDIA_DEVICES");
  }

  // Push for maximum rear-camera resolution the device will grant.
  // Safari often ignores huge ideals; still ask high, then fall back.
  const constraints: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    {
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraint of constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      await maximizeTrackQuality(stream);
      return stream;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("CAMERA_UNAVAILABLE");
}

function capabilityMax(
  range: ULongRange | undefined,
): number | undefined {
  return range && typeof range.max === "number" ? range.max : undefined;
}

/** Max resolution + continuous focus/exposure when the browser exposes them. */
async function maximizeTrackQuality(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track?.applyConstraints) return;

  const capabilities =
    typeof track.getCapabilities === "function"
      ? track.getCapabilities()
      : ({} as MediaTrackCapabilities);

  const widthMax = capabilityMax(capabilities.width);
  const heightMax = capabilityMax(capabilities.height);

  const advanced: Record<string, string>[] = [];
  const focusModes = (capabilities as { focusMode?: string[] }).focusMode;
  if (Array.isArray(focusModes)) {
    if (focusModes.includes("continuous")) advanced.push({ focusMode: "continuous" });
    else if (focusModes.includes("single-shot")) advanced.push({ focusMode: "single-shot" });
  }
  const exposureModes = (capabilities as { exposureMode?: string[] }).exposureMode;
  if (Array.isArray(exposureModes) && exposureModes.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" });
  }
  const whiteBalanceModes = (capabilities as { whiteBalanceMode?: string[] }).whiteBalanceMode;
  if (Array.isArray(whiteBalanceModes) && whiteBalanceModes.includes("continuous")) {
    advanced.push({ whiteBalanceMode: "continuous" });
  }

  try {
    await track.applyConstraints({
      width: { ideal: widthMax ?? 4032 },
      height: { ideal: heightMax ?? 3024 },
      ...(advanced.length > 0 ? { advanced } : {}),
    } as MediaTrackConstraints);
  } catch {
    try {
      await track.applyConstraints({
        width: { ideal: widthMax ?? 1920 },
        height: { ideal: heightMax ?? 1080 },
      });
    } catch {
      // Keep whatever resolution getUserMedia already gave us.
    }
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("READ_FAILED"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("READ_FAILED"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Give autofocus a moment after the preview is live / before the still. */
async function settleAutofocus(track: MediaStreamTrack | undefined): Promise<void> {
  const ios = isIosLike();
  if (!track) {
    await wait(ios ? 400 : 200);
    return;
  }
  try {
    const caps =
      typeof track.getCapabilities === "function"
        ? track.getCapabilities()
        : ({} as MediaTrackCapabilities);
    const focusModes = (caps as { focusMode?: string[] }).focusMode;
    if (Array.isArray(focusModes) && focusModes.includes("single-shot")) {
      await track.applyConstraints({
        advanced: [{ focusMode: "single-shot" }],
      } as unknown as MediaTrackConstraints);
      await wait(ios ? 700 : 450);
      return;
    }
  } catch {
    // ignore
  }
  await wait(ios ? 500 : 280);
}

async function captureWithImageCapture(
  track: MediaStreamTrack,
): Promise<string | null> {
  if (typeof ImageCapture === "undefined") return null;
  try {
    const imageCapture = new ImageCapture(track);
    const photoSettings: PhotoSettings = {};
    try {
      const caps = await imageCapture.getPhotoCapabilities();
      if (caps.imageWidth?.max) photoSettings.imageWidth = caps.imageWidth.max;
      if (caps.imageHeight?.max) photoSettings.imageHeight = caps.imageHeight.max;
      const fill = (caps as { fillLightMode?: string[] }).fillLightMode;
      if (Array.isArray(fill) && fill.includes("flash")) {
        (photoSettings as { fillLightMode?: string }).fillLightMode = "off";
      }
    } catch {
      // optional
    }
    const blob = await imageCapture.takePhoto(
      Object.keys(photoSettings).length > 0 ? photoSettings : undefined,
    );
    if (blob.size > 0) return await blobToDataUrl(blob);
  } catch {
    // try grabFrame next
  }

  try {
    const imageCapture = new ImageCapture(track) as ImageCapture & {
      grabFrame?: () => Promise<ImageBitmap>;
    };
    if (typeof imageCapture.grabFrame !== "function") return null;
    const bitmap = await imageCapture.grabFrame();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.98);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function captureFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string> {
  if (!video.videoWidth) throw new Error("CAMERA_UNAVAILABLE");

  // Prefer the latest decoded frame when the browser supports it.
  if (typeof video.requestVideoFrameCallback === "function") {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => resolve(), 400);
      video.requestVideoFrameCallback(() => {
        window.clearTimeout(timeout);
        resolve();
      });
    });
  } else {
    // Safari: wait a couple of frames so autofocus can settle into the buffer.
    await wait(120);
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CAMERA_UNAVAILABLE");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, 0, 0);
  // Near-lossless JPEG so OCR keeps fine print (Safari path has no ImageCapture).
  return canvas.toDataURL("image/jpeg", 0.97);
}

/** Full-resolution still when possible; else highest-quality preview frame. */
async function captureHighQualityStill(
  stream: MediaStream,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const track = stream.getVideoTracks()[0];
  // Re-bump resolution right before capture (Safari often starts lower).
  if (track) {
    await maximizeTrackQuality(stream);
    await settleAutofocus(track);
  } else {
    await settleAutofocus(undefined);
  }

  if (track) {
    const still = await captureWithImageCapture(track);
    if (still) return still;
  }

  return captureFromVideoFrame(video, canvas);
}

export function CameraCapture({
  onCapture,
  onMultipleCapture,
  onCancel,
  autoStart = false,
  allowFileUpload = false,
  allowMultipleFiles = false,
  compact = false,
}: Props) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [useNativeCapture, setUseNativeCapture] = useState(false);
  const [platformReady, setPlatformReady] = useState(false);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    setUseNativeCapture(prefersNativeCameraCapture());
    setPlatformReady(true);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !active) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setError(t("camera.unavailable"));
      stopCamera();
    });
  }, [active, stopCamera, t]);

  const startCamera = useCallback(async () => {
    if (starting || active) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t("scanner.insecureContext"));
      return;
    }

    setStarting(true);
    setError("");

    try {
      stopCamera();
      const media = await openCameraStream();
      streamRef.current = media;
      setActive(true);
    } catch (caught) {
      setError(t(cameraErrorKey(caught)));
    } finally {
      setStarting(false);
    }
  }, [active, starting, stopCamera, t]);

  useEffect(() => {
    if (!autoStart || !platformReady || autoStartedRef.current) return;
    // iOS Safari: skip weak in-browser preview; native Camera app is sharper for OCR.
    autoStartedRef.current = true;
    if (useNativeCapture) return;
    void startCamera();
  }, [autoStart, platformReady, startCamera, useNativeCapture]);

  async function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const stream = streamRef.current;
    if (!video || !canvas || !stream || capturing) return;

    setCapturing(true);
    setError("");
    try {
      const dataUrl = await captureHighQualityStill(stream, video, canvas);
      setPreview(dataUrl);
      stopCamera();
    } catch {
      setError(t("camera.unavailable"));
    } finally {
      setCapturing(false);
    }
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) return;

    for (const file of files) {
      if (!isAcceptedImageFile(file)) {
        setError(t("errors.invalidFileFormat"));
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(t("errors.fileTooLarge"));
        return;
      }
    }

    setError("");
    try {
      if (files.length > 1 && onMultipleCapture) {
        const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
        stopCamera();
        onMultipleCapture(dataUrls);
        return;
      }
      const dataUrl = await readFileAsDataUrl(files[0]);
      stopCamera();
      setPreview(dataUrl);
    } catch {
      setError(t("errors.uploadFailed"));
    }
  }

  async function uploadAndContinue() {
    if (!preview) return;
    onCapture(preview);
  }

  const previewFrameClass = compact
    ? "h-full w-full object-contain"
    : "max-h-[min(52dvh,24rem)] w-full object-contain";

  const previewShellClass = compact
    ? "mx-auto flex h-[min(28dvh,12.5rem)] w-full items-center justify-center overflow-hidden rounded-xl border border-card-border bg-black"
    : "mx-auto flex max-h-[min(52dvh,24rem)] w-full items-center justify-center overflow-hidden rounded-xl border border-card-border bg-black";

  const acceptAttr =
    "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

  return (
    <div className={`relative space-y-3 ${active && !preview ? "isolate" : ""}`}>
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {!preview ? (
        <>
          {useNativeCapture ? (
            <p className="text-xs text-muted">{t("camera.iosNativeHint")}</p>
          ) : null}
          <div
            className={
              active
                ? previewShellClass
                : "pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
            }
            aria-hidden={!active}
          >
            <video
              ref={videoRef}
              className={previewFrameClass}
              playsInline
              muted
              autoPlay
            />
          </div>
          <div className="flex flex-col gap-2">
            {useNativeCapture && !active ? (
              <PrimaryButton
                onClick={() => nativeCameraInputRef.current?.click()}
                disabled={starting}
              >
                {t("camera.capture")}
              </PrimaryButton>
            ) : !active ? (
              <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
                {starting ? t("scanner.starting") : t("camera.start")}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={() => void takePhoto()}
                disabled={capturing || starting}
              >
                {t("camera.capture")}
              </PrimaryButton>
            )}
            {allowFileUpload || useNativeCapture ? (
              <>
                <SecondaryButton
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={starting}
                >
                  {t("camera.uploadExisting")}
                </SecondaryButton>
                {useNativeCapture && !active ? (
                  <SecondaryButton
                    onClick={() => void startCamera()}
                    disabled={starting}
                  >
                    {starting ? t("scanner.starting") : t("camera.startBrowser")}
                  </SecondaryButton>
                ) : null}
                {/* Native iOS Camera app — full still resolution for OCR */}
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void onFileSelected(event)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept={acceptAttr}
                  multiple={allowMultipleFiles}
                  className="hidden"
                  onChange={(event) => void onFileSelected(event)}
                />
              </>
            ) : null}
            {onCancel ? (
              <SecondaryButton onClick={onCancel}>{t("common.cancel")}</SecondaryButton>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("camera.productPhoto")}
            className={
              compact
                ? "mx-auto max-h-[min(28dvh,12.5rem)] w-full rounded-xl border border-card-border bg-black object-contain"
                : "mx-auto max-h-[min(52dvh,24rem)] w-full rounded-xl border border-card-border bg-black object-contain"
            }
          />
          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => void uploadAndContinue()}>
              {t("common.next")}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setPreview(null);
                if (useNativeCapture) {
                  // Stay on native path; user taps Take photo again.
                  return;
                }
                void startCamera();
              }}
            >
              {t("camera.newPhoto")}
            </SecondaryButton>
            {allowFileUpload || useNativeCapture ? (
              <>
                {useNativeCapture ? (
                  <SecondaryButton onClick={() => nativeCameraInputRef.current?.click()}>
                    {t("camera.capture")}
                  </SecondaryButton>
                ) : null}
                <SecondaryButton onClick={() => galleryInputRef.current?.click()}>
                  {t("camera.uploadExisting")}
                </SecondaryButton>
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => void onFileSelected(event)}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept={acceptAttr}
                  multiple={allowMultipleFiles}
                  className="hidden"
                  onChange={(event) => void onFileSelected(event)}
                />
              </>
            ) : null}
            {onCancel ? (
              <SecondaryButton onClick={onCancel}>{t("common.cancel")}</SecondaryButton>
            ) : null}
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

async function uploadImage(dataUrl: string): Promise<string> {
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ dataUrl }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" && data.error
        ? data.error
        : "Upload failed",
    );
  }
  if (typeof data?.path !== "string" || !data.path) {
    throw new Error("Upload failed");
  }
  return data.path;
}

export {
  assessDocumentPhotoQuality,
  prepareDocumentImage,
} from "@/lib/document-image";
export { uploadImage };
