"use client";

import { useT } from "@/components/i18n-provider";
import {
  appButtonDangerFull,
  appButtonNeutral,
  appButtonPrimaryFull,
  appFooterButtonGrid,
} from "@/lib/app-ui";

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
      className="fixed inset-x-0 z-50 mx-auto w-full max-w-lg border-t border-card-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
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
          className={appButtonDangerFull}
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
    <div className="fixed inset-0 z-[70] mx-auto flex w-full max-w-lg flex-col bg-background">
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
