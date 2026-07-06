"use client";

import { useEffect, useMemo, useState } from "react";
import { ExpiryDatePicker } from "@/components/expiry-date-picker";
import { QuantityPicker } from "@/components/quantity-picker";
import { CopyIcon, PriceReduceIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { expiryIsoToYmd, expiryYmdToIso } from "@/lib/inventory";

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

export type ExpiryDetailEntry = {
  id: string;
  barcode: string;
  quantity: number;
  expiryDate: string;
  priceReducedAt: string | null;
  product: { name: string; imagePath: string | null };
};

type UpdateMeta = {
  merged?: boolean;
  removedId?: string;
};

type Props = {
  entry: ExpiryDetailEntry;
  storeId: string;
  onClose: () => void;
  onUpdated: (entry: ExpiryDetailEntry, meta?: UpdateMeta) => void;
};

export function ExpiryEntryDetailSheet({
  entry,
  storeId,
  onClose,
  onUpdated,
}: Props) {
  const { t, dateLocale } = useT();
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [expiryYmd, setExpiryYmd] = useState(() => expiryIsoToYmd(entry.expiryDate));
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriceReduceConfirm, setShowPriceReduceConfirm] = useState(false);
  const [reducingPrice, setReducingPrice] = useState(false);

  const savedPriceReduced = entry.priceReducedAt !== null;
  const [priceReducedDraft, setPriceReducedDraft] = useState(savedPriceReduced);

  const savedExpiryYmd = expiryIsoToYmd(entry.expiryDate);
  const parsedQuantity = Number(quantity);
  const quantityValid =
    quantity.length > 0 &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1;
  const hasChanges =
    expiryYmd !== savedExpiryYmd ||
    (quantityValid && parsedQuantity !== entry.quantity) ||
    priceReducedDraft !== savedPriceReduced;
  const canConfirm = hasChanges && quantityValid;
  const compactLayout =
    editingExpiry || editingQuantity || hasChanges;

  useEffect(() => {
    setQuantity(String(entry.quantity));
    setExpiryYmd(expiryIsoToYmd(entry.expiryDate));
    setPriceReducedDraft(entry.priceReducedAt !== null);
    setEditingExpiry(false);
    setEditingQuantity(false);
    setError(null);
    setShowPriceReduceConfirm(false);
  }, [entry.id, entry.quantity, entry.expiryDate, entry.priceReducedAt]);

  function revertDraft() {
    setQuantity(String(entry.quantity));
    setExpiryYmd(savedExpiryYmd);
    setPriceReducedDraft(savedPriceReduced);
    setEditingExpiry(false);
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

  async function confirmPriceReduction() {
    setReducingPrice(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          storeId,
          priceReduced: true,
        }),
      });
      const data = (await response.json()) as {
        entry?: ExpiryDetailEntry;
        error?: string;
      };

      if (!response.ok || !data.entry) {
        setError(data.error ?? t("expiry.saveFailed"));
        return;
      }

      onUpdated(data.entry);
      setShowPriceReduceConfirm(false);
    } catch {
      setError(t("expiry.saveFailed"));
    } finally {
      setReducingPrice(false);
    }
  }

  async function confirmChanges() {
    if (!canConfirm) return;

    const updates: { quantity?: number; expiryDate?: string } = {};
    if (parsedQuantity !== entry.quantity) {
      updates.quantity = parsedQuantity;
    }
    if (expiryYmd !== savedExpiryYmd) {
      updates.expiryDate = expiryYmd;
    }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        entryId: entry.id,
        storeId,
      };
      if (updates.quantity !== undefined) {
        body.quantity = updates.quantity;
      }
      if (updates.expiryDate !== undefined) {
        body.expiryDate = expiryYmdToIso(updates.expiryDate);
      }
      if (priceReducedDraft !== savedPriceReduced) {
        body.priceReduced = priceReducedDraft;
      }

      const response = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        entry?: ExpiryDetailEntry;
        merged?: boolean;
        removedId?: string;
        error?: string;
      };

      if (!response.ok || !data.entry) {
        setError(data.error ?? t("expiry.saveFailed"));
        return;
      }

      onUpdated(data.entry, {
        merged: data.merged,
        removedId: data.removedId,
      });

      setQuantity(String(data.entry.quantity));
      setExpiryYmd(expiryIsoToYmd(data.entry.expiryDate));
      setPriceReducedDraft(data.entry.priceReducedAt !== null);
      setEditingExpiry(false);
      setEditingQuantity(false);
    } catch {
      setError(t("expiry.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function onExpiryChange(nextYmd: string) {
    setExpiryYmd(nextYmd);
    setError(null);
  }

  function onQuantityChange(nextRaw: string) {
    setQuantity(nextRaw);
    setError(null);
  }

  const expiryDisplay = useMemo(() => {
    const [year, month, day] = expiryYmd.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      dateLocale,
      { timeZone: "UTC" },
    );
  }, [expiryYmd, dateLocale]);

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
          aria-label={t("expiry.closeImage")}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none text-foreground"
          onClick={onClose}
          disabled={saving || reducingPrice}
        >
          ×
        </button>

        <button
          type="button"
          aria-label={
            savedPriceReduced ? t("expiry.priceReduced") : t("expiry.reducePrice")
          }
          title={
            savedPriceReduced ? t("expiry.priceReduced") : t("expiry.reducePrice")
          }
          className="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-card-border bg-card text-foreground disabled:opacity-50"
          onClick={() => setShowPriceReduceConfirm(true)}
          disabled={saving || reducingPrice || savedPriceReduced}
        >
          <PriceReduceIcon className="h-4 w-4" />
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
                label={t("expiry.copyName")}
                copiedLabel={t("expiry.copied")}
              />
            </div>
            {entry.barcode ? (
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 font-mono text-xs tabular-nums text-muted">
                  {entry.barcode}
                </p>
                <CopyTextButton
                  text={entry.barcode}
                  label={t("expiry.copyBarcode")}
                  copiedLabel={t("expiry.copied")}
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
            <p className="mt-2 text-xs text-muted">{t("expiry.saving")}</p>
          ) : null}

          {compactLayout && editingExpiry ? (
            <div className="mt-3">
              <ExpiryDatePicker value={expiryYmd} onChange={onExpiryChange} />
            </div>
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
                editingExpiry
                  ? "border-primary bg-selected"
                  : "border-card-border bg-subtle"
              }`}
              onClick={() => {
                setEditingQuantity(false);
                setEditingExpiry((open) => !open);
              }}
              disabled={saving || reducingPrice}
              aria-expanded={editingExpiry}
            >
              <span className="text-sm text-muted">{t("expiry.validUntil")}</span>
              <span className="text-sm font-semibold text-foreground">
                {expiryDisplay}
              </span>
            </button>
            {!compactLayout && editingExpiry ? (
              <ExpiryDatePicker value={expiryYmd} onChange={onExpiryChange} />
            ) : null}

            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left disabled:opacity-60 ${
                editingQuantity
                  ? "border-primary bg-selected"
                  : "border-card-border bg-subtle"
              }`}
              onClick={() => {
                setEditingExpiry(false);
                setEditingQuantity((open) => !open);
              }}
              disabled={saving || reducingPrice}
              aria-expanded={editingQuantity}
            >
              <span className="text-sm text-muted">{t("expiry.pieces")}</span>
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

            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left disabled:opacity-60 ${
                priceReducedDraft !== savedPriceReduced
                  ? "border-primary bg-selected"
                  : "border-card-border bg-subtle"
              }`}
              onClick={() => {
                setEditingExpiry(false);
                setEditingQuantity(false);
                setPriceReducedDraft((current) => !current);
              }}
              disabled={saving || reducingPrice}
            >
              <span className="text-sm text-muted">{t("expiry.priceReduction")}</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {priceReducedDraft ? (
                  <>
                    <PriceReduceIcon className="h-4 w-4 shrink-0" aria-hidden />
                    {t("expiry.priceReductionYes")}
                  </>
                ) : (
                  t("expiry.priceReductionNo")
                )}
              </span>
            </button>
          </div>
        </div>

        {hasChanges ? (
          <div className="shrink-0 border-t border-card-border bg-card p-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
            <p className="text-sm font-semibold text-foreground">
              {t("expiry.confirmUpdateTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {t("expiry.confirmUpdateMessage")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                onClick={revertDraft}
                disabled={saving || reducingPrice}
              >
                {t("expiry.confirmCancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                onClick={() => void confirmChanges()}
                disabled={saving || reducingPrice || !canConfirm}
              >
                {saving ? t("expiry.saving") : t("expiry.confirmSave")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showPriceReduceConfirm ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-lg p-3">
            <div className="rounded-xl border border-card-border bg-card p-3">
              <p className="text-sm font-semibold">
                {t("expiry.reducePriceConfirmTitle")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("expiry.reducePriceConfirmMessage")}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
                  onClick={() => setShowPriceReduceConfirm(false)}
                  disabled={reducingPrice}
                >
                  {t("expiry.confirmCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
                  onClick={() => void confirmPriceReduction()}
                  disabled={reducingPrice}
                >
                  {reducingPrice ? t("expiry.saving") : t("expiry.reducePrice")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
