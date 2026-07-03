"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

type Props = {
  onCapture: (dataUrl: string) => void;
  onCancel?: () => void;
};

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

export function CameraCapture({ onCapture, onCancel }: Props) {
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  async function uploadAndContinue() {
    if (!preview) return;
    onCapture(preview);
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {!preview ? (
        <>
          <video
            ref={videoRef}
            className={
              active
                ? "max-w-full rounded-xl border border-card-border"
                : "hidden"
            }
            playsInline
            muted
            autoPlay
          />
          {!active ? (
            <PrimaryButton onClick={() => void startCamera()} disabled={starting}>
              {starting ? t("scanner.starting") : t("camera.start")}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={takePhoto}>{t("camera.capture")}</PrimaryButton>
          )}
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={t("camera.productPhoto")}
            className="w-full rounded-xl border border-card-border"
          />
          <PrimaryButton onClick={() => void uploadAndContinue()}>{t("common.next")}</PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setPreview(null);
              void startCamera();
            }}
          >
            {t("camera.newPhoto")}
          </SecondaryButton>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {onCancel ? <SecondaryButton onClick={onCancel}>{t("common.cancel")}</SecondaryButton> : null}
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
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Upload failed");
  }
  return data.path as string;
}

export { uploadImage };
