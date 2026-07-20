"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type Props = {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
  autoStart?: boolean;
  allowFileUpload?: boolean;
  /**
   * Cap the live/preview image height so Capture / Upload / Cancel stay on
   * screen (needed on Add document where the phone camera is otherwise huge).
   */
  compact?: boolean;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

  const constraints: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: { ideal: "user" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraint of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraint);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("CAMERA_UNAVAILABLE");
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

export function CameraCapture({
  onCapture,
  onCancel,
  autoStart = false,
  allowFileUpload = false,
  compact = false,
}: Props) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const autoStartedRef = useRef(false);

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
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startCamera();
  }, [autoStart, startCamera]);

  function takePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    stopCamera();
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError(t("errors.invalidFileFormat"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("errors.fileTooLarge"));
      return;
    }

    setError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
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
    ? "mx-auto max-h-[min(38vh,16rem)] w-full rounded-xl border border-card-border bg-black object-contain"
    : "max-w-full rounded-xl border border-card-border";

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {!preview ? (
        <>
          <video
            ref={videoRef}
            className={active ? previewFrameClass : "hidden"}
            playsInline
            muted
            autoPlay
          />
          <div className="flex flex-col gap-2">
            {!active ? (
              <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
                {starting ? t("scanner.starting") : t("camera.start")}
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={takePhoto}>{t("camera.capture")}</PrimaryButton>
            )}
            {allowFileUpload ? (
              <>
                <SecondaryButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={starting}
                >
                  {t("camera.uploadExisting")}
                </SecondaryButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
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
                ? previewFrameClass
                : "w-full rounded-xl border border-card-border"
            }
          />
          <div className="flex flex-col gap-2">
            <PrimaryButton onClick={() => void uploadAndContinue()}>
              {t("common.next")}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setPreview(null);
                void startCamera();
              }}
            >
              {t("camera.newPhoto")}
            </SecondaryButton>
            {allowFileUpload ? (
              <>
                <SecondaryButton onClick={() => fileInputRef.current?.click()}>
                  {t("camera.uploadExisting")}
                </SecondaryButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
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

/** Shrink and enhance phone photos for better OCR and nginx body limits. */
export async function prepareDocumentImage(dataUrl: string): Promise<string> {
  const TARGET_BYTES = 700_000;
  const STEPS: Array<{ maxEdge: number; quality: number }> = [
    { maxEdge: 1600, quality: 0.78 },
    { maxEdge: 1280, quality: 0.72 },
    { maxEdge: 1024, quality: 0.68 },
    { maxEdge: 900, quality: 0.58 },
  ];

  const blob = await fetch(dataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "from-image",
  });

  try {
    let best = dataUrl;
    for (const step of STEPS) {
      const scale = Math.min(
        1,
        step.maxEdge / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not prepare photo");
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      enhanceDocumentContrast(ctx, width, height);
      best = canvas.toDataURL("image/jpeg", step.quality);
      const approxBytes = Math.floor(((best.length - 23) * 3) / 4);
      if (approxBytes <= TARGET_BYTES) {
        return best;
      }
    }
    return best;
  } finally {
    bitmap.close();
  }
}

function enhanceDocumentContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const contrast = 1.18;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = Math.min(
      255,
      Math.max(0, (gray - 128) * contrast + 128),
    );
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
}

export { uploadImage };