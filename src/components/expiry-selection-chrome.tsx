"use client";

import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  appButtonDangerFull,
  appButtonNeutral,
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appContentMaxW,
  appFooterButtonGrid,
} from "@/lib/app-ui";
import type { ExpiryExportFormat } from "@/lib/expiry-selection-export";

/** Height of the Cancel/Remove bar above the bottom nav (for ActionFlash lift). */
export const EXPIRY_SELECTION_FOOTER_LIFT = "4rem";

export function ExpirySelectionFooter({
  selectedCount,
  busy,
  onCancel,
  onRemove,
}: {
  selectedCount: number;
  busy: boolean;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { t } = useT();

  return (
    <div
      className={`fixed inset-x-0 z-50 mx-auto w-full ${appContentMaxW} border-t border-card-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90`}
      style={{
        bottom:
          "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className={appFooterButtonGrid}>
        <button
          type="button"
          className={appButtonNeutral}
          onClick={onCancel}
          disabled={busy}
        >
          {t("expiry.confirmCancel")}
        </button>
        <button
          type="button"
          className={`${appButtonDangerFull} whitespace-nowrap`}
          disabled={selectedCount === 0 || busy}
          onClick={onRemove}
        >
          {busy
            ? t("expiry.bulkRemoving")
            : t("expiry.bulkRemove", { count: selectedCount })}
        </button>
      </div>
    </div>
  );
}

export function ExpiryExportPreview({
  preview,
  onClose,
}: {
  preview: { url: string; filename: string } | null;
  onClose: () => void;
}) {
  const { t } = useT();
  if (!preview) return null;

  return (
    <div className={`fixed inset-0 z-[70] mx-auto flex w-full ${appContentMaxW} flex-col bg-background`}>
      <div className="min-h-0 flex-1 overflow-auto px-3 pt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt="" className="w-full" />
        <p className="mt-3 text-sm text-muted">{t("expiry.exportSaveHint")}</p>
      </div>
      <div
        className={`${appFooterButtonGrid} border-t border-card-border px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2`}
      >
        <button type="button" className={appButtonNeutral} onClick={onClose}>
          {t("expiry.confirmCancel")}
        </button>
        <a
          href={preview.url}
          download={preview.filename}
          className={appButtonPrimaryFull}
        >
          {t("expiry.exportSavePhotos")}
        </a>
      </div>
    </div>
  );
}

export function ExpiryExportFormatDialog({
  open,
  onCancel,
  onChoose,
}: {
  open: boolean;
  onCancel: () => void;
  onChoose: (format: ExpiryExportFormat) => void;
}) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expiry-export-format-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="expiry-export-format-title"
          className="text-center text-lg font-semibold text-foreground"
        >
          {t("expiry.exportFormatTitle")}
        </h2>
        <p className="mt-2 text-center text-sm text-muted">
          {t("expiry.exportFormatHint")}
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className={appButtonPrimaryFull}
            onClick={() => onChoose("picture")}
          >
            {t("expiry.exportAsPicture")}
          </button>
          <button
            type="button"
            className={appButtonNeutralFull}
            onClick={() => onChoose("excel")}
          >
            {t("expiry.exportAsExcel")}
          </button>
          <button
            type="button"
            className={appButtonNeutralFull}
            onClick={onCancel}
          >
            {t("expiry.confirmCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
