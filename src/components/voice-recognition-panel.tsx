"use client";

import { LoadingSpinner } from "@/components/loading-spinner";
import { useT } from "@/components/i18n-provider";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";

type Props = {
  phase: "recording" | "recognizing";
};

function MicPulseIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function VoiceRecognitionPanel({ phase }: Props) {
  const { t } = useT();
  useScreenWakeLock(true);

  const recording = phase === "recording";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-card-border bg-[radial-gradient(ellipse_at_center,rgb(16_185_129/0.08),transparent_65%)] px-6 pb-10 pt-14">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
        <div
          className={`mb-5 flex size-16 items-center justify-center rounded-full border border-primary/40 text-primary ${
            recording ? "animate-pulse bg-primary/15" : "bg-primary/10"
          }`}
        >
          {recording ? (
            <MicPulseIcon className="size-8" />
          ) : (
            <LoadingSpinner size="lg" />
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/brand-mark.png?v=3"
          alt=""
          width={48}
          height={48}
          decoding="async"
          className="mb-4 h-12 w-12 object-contain opacity-90"
        />
        <p className="text-base font-semibold text-foreground">
          {recording
            ? t("scan.voiceListening")
            : t("scan.voiceRecognizing")}
        </p>
        <p className="mt-2 text-sm leading-snug text-muted">
          {recording
            ? t("scan.voiceListeningHint")
            : t("scan.voiceRecognizingHint")}
        </p>
      </div>
    </div>
  );
}
