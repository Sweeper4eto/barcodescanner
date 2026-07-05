"use client";

import { useEffect } from "react";
import { useT } from "@/components/i18n-provider";
import { navigateApp } from "@/lib/app-navigation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <p className="text-lg font-semibold text-foreground">{t("errors.pageLoadFailed")}</p>
      <p className="text-sm text-muted">{t("errors.pageLoadFailedHint")}</p>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-3 font-medium text-primary-fg"
          onClick={() => reset()}
        >
          {t("errors.reload")}
        </button>
        <button
          type="button"
          className="rounded-xl border border-input-border bg-card px-4 py-3 text-foreground"
          onClick={() => navigateApp("/app")}
        >
          {t("errors.goHome")}
        </button>
      </div>
    </div>
  );
}
