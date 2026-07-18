"use client";

import { useEffect } from "react";

type Props = {
  message: string | null;
  tone?: "success" | "error";
  onClear: () => void;
  durationMs?: number;
};

export function ActionFlash({
  message,
  tone = "success",
  onClear,
  durationMs = 2500,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClear, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onClear]);

  if (!message) return null;

  const toneClass =
    tone === "error"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-primary/30 bg-selected text-foreground";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mb-3 rounded-xl border px-3 py-2 text-sm ${toneClass}`}
    >
      {message}
    </p>
  );
}