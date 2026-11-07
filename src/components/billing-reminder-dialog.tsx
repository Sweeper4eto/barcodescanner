"use client";

import { useEffect, useState } from "react";
import {
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appPageTopGlowClass,
} from "@/lib/app-ui";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  shouldShowBillingReminder,
  snoozeBillingReminder,
} from "@/lib/billing-reminder";
import { navigateApp } from "@/lib/app-navigation";

type BillingSnapshot = {
  enabled: boolean;
  currentMonthPaid?: boolean;
  currentYear?: number;
  currentMonth?: number;
};

type Props = {
  /** Home is ready and this owner has billing enabled. */
  ready?: boolean;
  /** Wait until What's New has settled so dialogs do not stack. */
  allowAfterWhatsNew?: boolean;
};

export function BillingReminderDialog({
  ready = true,
  allowAfterWhatsNew = true,
}: Props) {
  const { t, monthName } = useT();
  const { user } = useAppSession();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(
    null,
  );

  useEffect(() => {
    if (!ready || !allowAfterWhatsNew || user?.paymentLocked) return;
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/billing", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as BillingSnapshot;
        if (cancelled) return;
        if (!data.enabled || data.currentMonthPaid) return;
        const year = data.currentYear;
        const month = data.currentMonth;
        if (typeof year !== "number" || typeof month !== "number") return;
        if (!shouldShowBillingReminder(year, month)) return;
        setPeriod({ year, month });
        setOpen(true);
      } catch {
        /* ignore — home still works without the reminder */
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, allowAfterWhatsNew, user?.paymentLocked]);

  function dismissAndSnooze() {
    if (period) snoozeBillingReminder(period.year, period.month);
    setOpen(false);
  }

  function goToBilling() {
    dismissAndSnooze();
    navigateApp("/app/billing");
  }

  if (!open || !period) return null;

  return (
    <div
      className="fixed inset-x-0 z-[74] flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-6 sm:items-center sm:pb-6"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-reminder-title"
      onClick={dismissAndSnooze}
    >
      <div
        className="relative flex max-h-full w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className={appPageTopGlowClass}
        />

        <div className="relative shrink-0 text-center">
          <div className="flex justify-center">
            <span className="inline-flex items-center rounded-full border border-primary/45 bg-primary/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-primary">
              {t("billing.reminderBadge")}
            </span>
          </div>

          <h2
            id="billing-reminder-title"
            className="mt-4 text-[1.35rem] font-semibold leading-tight text-foreground"
          >
            {t("billing.reminderTitle", { month: monthName(period.month) })}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("billing.reminderBody")}
          </p>
        </div>

        <div className="relative mt-6 flex shrink-0 flex-col gap-2.5">
          <button
            type="button"
            onClick={goToBilling}
            className={appButtonPrimaryFull}
          >
            {t("billing.reminderGo")}
          </button>
          <button
            type="button"
            onClick={dismissAndSnooze}
            className={appButtonNeutralFull}
          >
            {t("billing.reminderLater")}
          </button>
        </div>
      </div>
    </div>
  );
}
