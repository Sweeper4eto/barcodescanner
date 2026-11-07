"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import type { MessageKey } from "@/i18n";
import {
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appPageTopGlowClass,
} from "@/lib/app-ui";
import type { PaymentDetailRow } from "@/lib/payment-methods";

const ROW_LABEL_KEYS: Record<PaymentDetailRow["labelKey"], MessageKey> = {
  payRecipient: "billing.payRecipient",
  payRevolutUser: "billing.payRevolutUser",
  payIban: "billing.payIban",
  payBic: "billing.payBic",
  payBankName: "billing.payBankName",
  payAmount: "billing.payAmount",
  payReference: "billing.payReference",
};

function formatEuro(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `€${rounded}` : `€${rounded.toFixed(2)}`;
}

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
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-card-border text-muted hover:text-foreground"
      onClick={() => void onCopy()}
    >
      {copied ? (
        <CheckIcon className="size-3.5 text-primary" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </button>
  );
}

type Props = {
  open: boolean;
  title: string;
  rows: readonly PaymentDetailRow[];
  amountDue: number;
  paymentReference: string;
  /** Optional deep link (e.g. Revolut.me) shown as a primary action. */
  externalPayUrl?: string;
  externalPayLabel?: string;
  onClose: () => void;
};

export function PaymentMethodDialog({
  open,
  title,
  rows,
  amountDue,
  paymentReference,
  externalPayUrl,
  externalPayLabel,
  onClose,
}: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();

  if (!open) return null;

  const amountText = formatEuro(amountDue);

  return (
    <div
      className="fixed inset-x-0 z-[74] flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-6 sm:items-center sm:pb-6"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-method-title"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border border-card-border bg-background px-4 pb-4 pt-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className={appPageTopGlowClass}
        />
        <h2
          id="payment-method-title"
          className="relative text-lg font-semibold text-foreground"
        >
          {title}
        </h2>

        <div className="relative mt-3 max-h-[min(24rem,55vh)] space-y-0 overflow-y-auto overscroll-y-contain rounded-2xl border border-card-border">
          {rows.map((row) => {
            const value = row.amount
              ? amountText
              : row.reference
                ? paymentReference
                : (row.value ?? "");
            return (
              <div
                key={row.labelKey}
                className="flex items-start justify-between gap-2 border-b border-card-border px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">
                    {t(ROW_LABEL_KEYS[row.labelKey])}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-sm text-foreground">
                    {value}
                  </p>
                </div>
                <CopyTextButton
                  text={value}
                  label={t("billing.payCopy")}
                  copiedLabel={t("billing.payCopied")}
                />
              </div>
            );
          })}
        </div>

        <div className="relative mt-4 flex flex-col gap-2">
          {externalPayUrl ? (
            <a
              href={externalPayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={appButtonPrimaryFull}
            >
              {externalPayLabel ?? t("billing.payOpenRevolut")}
            </a>
          ) : null}
          <button
            type="button"
            className={appButtonNeutralFull}
            onClick={onClose}
          >
            {t("billing.payClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
