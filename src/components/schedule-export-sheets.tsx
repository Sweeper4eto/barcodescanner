"use client";

import { CancelButton } from "@/components/cancel-button";
import { useT } from "@/components/i18n-provider";
import {
  appButtonNeutral,
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appFooterButtonGrid,
} from "@/lib/app-ui";

export function ScheduleSaveFormatDialog({
  open,
  saving,
  top,
  bottom,
  onClose,
  onPdf,
  onPicture,
}: {
  open: boolean;
  saving: boolean;
  top: number;
  bottom: number;
  onClose: () => void;
  onPdf: () => void;
  onPicture: () => void;
}) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{ top, bottom }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-save-format-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="schedule-save-format-title"
          className="text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {t("schedule.saveWeekFormatTitle")}
        </h2>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            className={appButtonPrimaryFull}
            onClick={onPdf}
          >
            {t("schedule.saveWeekAsPdf")}
          </button>
          <button
            type="button"
            disabled={saving}
            className={appButtonNeutralFull}
            onClick={onPicture}
          >
            {t("schedule.saveWeekAsPicture")}
          </button>
          <CancelButton disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </CancelButton>
        </div>
      </div>
    </div>
  );
}

export function SchedulePicturePreview({
  preview,
  onClose,
}: {
  preview: { url: string; filename: string } | null;
  onClose: () => void;
}) {
  const { t } = useT();
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-[80] mx-auto flex w-full max-w-lg flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt="" className="w-full" />
        <p className="mt-3 text-sm text-muted">{t("schedule.saveWeekPictureHint")}</p>
      </div>
      <div
        className={`${appFooterButtonGrid} border-t border-card-border px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2`}
      >
        <button type="button" className={appButtonNeutral} onClick={onClose}>
          {t("common.cancel")}
        </button>
        <a
          href={preview.url}
          download={preview.filename}
          className={appButtonPrimaryFull}
        >
          {t("schedule.saveWeekPictureSave")}
        </a>
      </div>
    </div>
  );
}
