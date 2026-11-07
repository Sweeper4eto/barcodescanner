"use client";

import { useEffect, useState } from "react";
import { SecondaryButton } from "@/components/auth-forms";
import { BackArrowIcon } from "@/components/app-nav-icons";
import { LoadingSpinnerPage } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { PaymentMethodDialog } from "@/components/payment-method-dialog";
import { useT } from "@/components/i18n-provider";
import {
  appButtonRowNeutral,
  appChromeInset,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import { navigateApp } from "@/lib/app-navigation";
import {
  BANK_TRANSFER_ROWS,
  REVOLUT_DETAILS,
  REVOLUT_ROWS,
} from "@/lib/payment-methods";

type BillingPayload = {
  enabled: boolean;
  expectedAmount: number;
  referralCount?: number;
  referralDiscount?: number;
  paymentReference?: string;
};

function formatEuro(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `€${rounded}` : `€${rounded.toFixed(2)}`;
}

type MethodId = "bank" | "revolut";

export default function BillingPayPage() {
  const { t } = useT();
  const [amountDue, setAmountDue] = useState<number | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<MethodId | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/billing");
        if (response.status === 403) {
          navigateApp("/app");
          return;
        }
        if (!response.ok) {
          throw new Error("load failed");
        }
        const json = (await response.json()) as BillingPayload;
        if (cancelled) return;
        if (!json.enabled) {
          navigateApp("/app");
          return;
        }
        setAmountDue(json.expectedAmount);
        setReferralCount(json.referralCount ?? 0);
        setReferralDiscount(json.referralDiscount ?? 0);
        setPaymentReference(json.paymentReference ?? "");
      } catch {
        if (!cancelled) setError(t("billing.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className={`${appPageShell} ${appChromeInset} pb-8 pt-1`}>
      <MobilePageHeader className="mb-3" />
      <h1 className={`${appListInset} text-2xl font-semibold text-foreground`}>
        {t("billing.payTitle")}
      </h1>
      <p className={`${appListInset} mt-1 text-sm text-muted`}>
        {t("billing.paySubtitle")}
      </p>

      {loading ? (
        <LoadingSpinnerPage />
      ) : error ? (
        <p className="mt-4 rounded-2xl border border-danger-border bg-danger/10 p-4 text-sm text-error">
          {error}
        </p>
      ) : amountDue !== null ? (
        <div className={`${appListInset} mt-4 space-y-3`}>
          <div className="rounded-2xl border border-card-border border-l-4 border-l-primary bg-selected px-3.5 py-3">
            <p className="text-xs font-medium text-muted">
              {t("billing.payAmountDue")}
            </p>
            <p className="mt-1 text-3xl font-semibold text-foreground">
              {formatEuro(amountDue)}
            </p>
            {referralDiscount > 0 ? (
              <p className="mt-1 text-xs text-muted">
                {t("billing.referralDiscount", {
                  amount: String(Math.round(referralDiscount * 100) / 100),
                  count: String(referralCount),
                  per: "5",
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("billing.payMethods")}
            </p>
            <button
              type="button"
              className={appButtonRowNeutral}
              onClick={() => setMethod("bank")}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/45 text-sm font-bold text-primary"
                >
                  €
                </span>
                <span>{t("billing.payBankTransfer")}</span>
              </span>
              <span aria-hidden className="text-primary">
                ›
              </span>
            </button>
            <button
              type="button"
              className={appButtonRowNeutral}
              onClick={() => setMethod("revolut")}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#0075EB]/55 text-sm font-bold text-[#60a5fa]"
                >
                  R
                </span>
                <span>{t("billing.payRevolut")}</span>
              </span>
              <span aria-hidden className="text-primary">
                ›
              </span>
            </button>
          </div>

          <div className="pt-1">
            <SecondaryButton
              onClick={() => navigateApp("/app/billing")}
              icon={<BackArrowIcon className="size-4 shrink-0" />}
            >
              {t("common.back")}
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      <PaymentMethodDialog
        open={method === "bank"}
        title={t("billing.payBankTransfer")}
        rows={BANK_TRANSFER_ROWS}
        amountDue={amountDue ?? 0}
        paymentReference={paymentReference}
        onClose={() => setMethod(null)}
      />
      <PaymentMethodDialog
        open={method === "revolut"}
        title={t("billing.payRevolut")}
        rows={REVOLUT_ROWS}
        amountDue={amountDue ?? 0}
        paymentReference={paymentReference}
        externalPayUrl={REVOLUT_DETAILS.payUrl}
        externalPayLabel={t("billing.payOpenRevolut")}
        onClose={() => setMethod(null)}
      />
    </div>
  );
}
