"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import {
  ExpiryDatePicker,
  type ExpiryDatePickerHandle,
} from "@/components/expiry-date-picker";
import { QuantityPicker } from "@/components/quantity-picker";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/i18n-provider";
import { formatLocaleDay } from "@/lib/expiry";
import {
  type DocumentDraftItem,
  draftHasMissingInfo,
  draftItemValid,
} from "@/lib/document-draft";

type Props = {
  item: DocumentDraftItem;
  onClose: () => void;
  onSave: (patch: Partial<DocumentDraftItem>) => void;
};

export function DocumentDraftDetailSheet({ item, onClose, onSave }: Props) {
  const { t, dateLocale } = useT();
  const datePickerRef = useRef<ExpiryDatePickerHandle>(null);
  const [name, setName] = useState(item.name);
  const [barcode, setBarcode] = useState(item.barcode);
  const [articul, setArticul] = useState(item.articul);
  const [quantity, setQuantity] = useState(item.quantity);
  const [expiryYmd, setExpiryYmd] = useState(item.expiryYmd);
  // Open date editor by default so OCR mistakes (e.g. 06↔08) are easy to fix.
  const [editingExpiry, setEditingExpiry] = useState(true);
  const [editingQuantity, setEditingQuantity] = useState(false);

  useEffect(() => {
    setName(item.name);
    setBarcode(item.barcode);
    setArticul(item.articul);
    setQuantity(item.quantity);
    setExpiryYmd(item.expiryYmd);
    setEditingExpiry(true);
    setEditingQuantity(false);
  }, [
    item.key,
    item.name,
    item.barcode,
    item.articul,
    item.quantity,
    item.expiryYmd,
  ]);

  const draft: DocumentDraftItem = {
    ...item,
    name,
    barcode,
    articul,
    quantity,
    expiryYmd,
  };

  const expiryDisplay = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryYmd)) {
      return t("addDocument.missingExpiry");
    }
    return formatLocaleDay(expiryYmd, dateLocale, { utc: true });
  }, [expiryYmd, dateLocale, t]);

  function handleSave() {
    // Flush typed DD.MM.YYYY before reading state — mobile often skips blur on Save.
    let nextExpiry = expiryYmd;
    if (editingExpiry && datePickerRef.current) {
      const flushed = datePickerRef.current.flush();
      if (flushed === null) return;
      nextExpiry = flushed;
    }
    const nextDraft: DocumentDraftItem = { ...draft, expiryYmd: nextExpiry };
    if (!draftItemValid(nextDraft)) {
      setExpiryYmd(nextExpiry);
      return;
    }

    onSave({
      name,
      barcode,
      articul,
      quantity,
      expiryYmd: nextExpiry,
      productId: barcode.trim() !== item.barcode.trim() ? null : item.productId,
      productImagePath:
        barcode.trim() !== item.barcode.trim() ? null : item.productImagePath,
      matchSource:
        barcode.trim() !== item.barcode.trim() ? null : item.matchSource,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-card"
      role="dialog"
      aria-modal="true"
      aria-label={t("addDocument.editItem")}
    >
      <div className="relative flex h-[min(17vh,6.5rem)] shrink-0 items-center justify-center bg-black/90">
        <button
          type="button"
          aria-label={t("common.cancel")}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-card-border bg-card text-lg leading-none text-foreground"
          onClick={onClose}
        >
          ×
        </button>
        <ProductImage
          src={item.productImagePath}
          alt=""
          className="h-full max-h-20 w-auto max-w-[45%] object-contain"
          placeholderClassName="h-20 w-20 rounded-lg text-[10px]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)]">
        {draftHasMissingInfo(draft) ? (
          <p className="mb-3 rounded-lg border border-danger-border bg-danger/5 px-3 py-2 text-xs font-semibold text-error">
            {t("addDocument.missingInfo")}
          </p>
        ) : null}

        <label className="block text-sm font-medium text-foreground">
          {t("common.name")}
          <input
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("common.noName")}
          />
        </label>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            {t("common.barcode")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 font-mono text-sm text-foreground"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            {t("common.articul")}
            <input
              className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
              value={articul}
              onChange={(event) => setArticul(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 space-y-2">
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${
              editingExpiry
                ? "border-primary bg-selected"
                : "border-card-border bg-subtle"
            }`}
            onClick={() => {
              setEditingQuantity(false);
              setEditingExpiry((open) => !open);
            }}
            aria-expanded={editingExpiry}
          >
            <span className="text-sm text-muted">{t("expiry.validUntil")}</span>
            <span
              className={`text-sm font-semibold ${
                !/^\d{4}-\d{2}-\d{2}$/.test(expiryYmd)
                  ? "text-error"
                  : "text-foreground"
              }`}
            >
              {expiryDisplay}
            </span>
          </button>
          {editingExpiry ? (
            <ExpiryDatePicker
              ref={datePickerRef}
              value={expiryYmd}
              onChange={setExpiryYmd}
              allowPast
            />
          ) : null}

          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${
              editingQuantity
                ? "border-primary bg-selected"
                : "border-card-border bg-subtle"
            }`}
            onClick={() => {
              setEditingExpiry(false);
              setEditingQuantity((open) => !open);
            }}
            aria-expanded={editingQuantity}
          >
            <span className="text-sm text-muted">{t("expiry.pieces")}</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {quantity}
            </span>
          </button>
          {editingQuantity ? (
            <QuantityPicker
              value={quantity}
              onChange={setQuantity}
              startWithGridOpen={false}
            />
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <SecondaryButton onClick={onClose}>{t("common.cancel")}</SecondaryButton>
          <PrimaryButton onClick={handleSave}>
            {t("common.save")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
