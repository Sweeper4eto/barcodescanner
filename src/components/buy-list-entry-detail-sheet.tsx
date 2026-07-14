"use client";

import { useEffect, useState } from "react";
import { QuantityPicker } from "@/components/quantity-picker";
import { CopyIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";

function CopyTextButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <button
      type="button"
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-muted hover:text-foreground"
      onClick={() => void onCopy()}
    >
      {copied ? (
        <span className="text-[10px] font-semibold text-primary">OK</span>
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export type BuyListDetailEntry = {
  id: string;
  barcode: string;
  quantity: number;
  product: { name: string; imagePath: string | null };
};

type Props = {
  entry: BuyListDetailEntry;
  storeId: string;
  onClose: () => void;
  onUpdated: (entry: BuyListDetailEntry) => void;
};

export function BuyListEntryDetailSheet({
  entry,
  storeId,
  onClose,
  onUpdated,
}: Props) {
  const { t } = useT();
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.length > 0 &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1;
  const hasChanges = quantityValid && parsedQuantity !== entry.quantity;
  const canConfirm = hasChanges && quantityValid;
  const compactLayout = editingQuantity || hasChanges;

  useEffect(() => {
    setQuantity(String(entry.quantity));
    setEditingQuantity(false);
    setError(null);
  }, [entry.id, entry.quantity]);

  function revertDraft() {
    setQuantity(String(entry.quantity));
    setEditingQuantity(false);
    setError(null);
  }

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  async function confirmChanges() {
    if (!canConfirm) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/buy-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          storeId,
          quantity: parsedQuantity,
        }),
      });
      const data = (await response.json()) as {
        entry?: BuyListDetailEntry;
        error?: string;
      };

      if (!response.ok || !data.entry) {
        setError(data.error ?? t("buyList.saveFailed"));
        return;
      }

      onUpdated(data.entry);
      setQuantity(String(data.entry.quantity));
      setEditingQuantity(false);
    } catch {
      setError(t("buyList.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function onQuantityChange(nextRaw: string) {
    setQuantity(nextRaw);
    setError(null);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-card"
      role="dialog"
      aria-modal="true"
      aria-label={entry.product.name}
    >
      <div
        className={`relative flex shrink-0 items-center justify-center bg-black/90 transition-[height] duration-200 ${
          compactLayout ? "h-[min(17vh,6.5rem)]" : "h-[50vh]"
        }`}
      >
        <button
          type="button"
          aria-label={t("buyList.closeImage")}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none text-foreground"
          onClick={onClose}
          disabled={saving}
        >
          ×
        </button>

        {entry.product.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.product.imagePath}
            alt={entry.product.name}
            className={
              compactLayout
                ? "h-full max-h-20 w-auto max-w-[45%] object-contain"
                : "h-full w-full object-contain p-3"
            }
          />
        ) : (
          <div
            className={`flex items-center justify-center rounded-2xl bg-subtle font-bold text-muted ${
              compactLayout ? "h-14 w-14 text-2xl" : "h-28 w-28 text-4xl"
            }`}
            aria-hidden
          >
            {entry.product.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-card-border">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">
                {entry.product.name}
              </h2>
              <CopyTextButton
                text={entry.product.name}
                label={t("buyList.copyName")}
                copiedLabel={t("buyList.copied")}
              />
            </div>
            {entry.barcode ? (
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 font-mono text-xs tabular-nums text-muted">
                  {entry.barcode}
                </p>
                <CopyTextButton
                  text={entry.barcode}
                  label={t("buyList.copyBarcode")}
                  copiedLabel={t("buyList.copied")}
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {saving && !hasChanges ? (
            <p className="mt-2 text-xs text-muted">{t("buyList.saving")}</p>
          ) : null}

          {compactLayout && editingQuantity ? (
            <div className="mt-3">
              <QuantityPicker
                value={quantity}
                onChange={onQuantityChange}
                startWithGridOpen
              />
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left disabled:opacity-60 ${
                editingQuantity
                  ? "border-primary bg-selected"
                  : "border-card-border bg-subtle"
              }`}
              onClick={() => setEditingQuantity((open) => !open)}
              disabled={saving}
              aria-expanded={editingQuantity}
            >
              <span className="text-sm text-muted">{t("buyList.pieces")}</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {quantity}
              </span>
            </button>
            {!compactLayout && editingQuantity ? (
              <QuantityPicker
                value={quantity}
                onChange={onQuantityChange}
                startWithGridOpen={false}
              />
            ) : null}
          </div>
        </div>

        {hasChanges ? (
          <div className="shrink-0 border-t border-card-border bg-card p-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
            <p className="text-sm font-semibold text-foreground">
              {t("buyList.confirmUpdateTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {t("buyList.confirmUpdateMessage")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                onClick={revertDraft}
                disabled={saving}
              >
                {t("buyList.confirmCancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                onClick={() => void confirmChanges()}
                disabled={saving || !canConfirm}
              >
                {saving ? t("buyList.saving") : t("buyList.confirmSave")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
