"use client";

import { useT } from "@/components/i18n-provider";
import {
  EXPIRY_PERIOD_OPTIONS,
  type ExpiryPeriod,
} from "@/lib/expiry-period";

type Props = {
  value: ExpiryPeriod;
  onChange: (period: ExpiryPeriod) => void;
};

function periodLabel(period: ExpiryPeriod, t: ReturnType<typeof useT>["t"]) {
  switch (period) {
    case "2w":
      return t("expiry.period2Weeks");
    case "1m":
      return t("expiry.period1Month");
    case "3m":
      return t("expiry.period3Months");
    case "all":
      return t("expiry.periodAll");
  }
}

export function ExpiryPeriodFilter({ value, onChange }: Props) {
  const { t } = useT();

  return (
    <div className="mb-2">
      <p className="mb-0.5 text-[10px] font-medium leading-none text-muted">
        {t("expiry.periodLabel")}
      </p>
      <div className="flex gap-0.5">
        {EXPIRY_PERIOD_OPTIONS.map((period) => {
          const active = period === value;
          return (
            <button
              key={period}
              type="button"
              onClick={() => onChange(period)}
              className={`min-w-0 flex-1 rounded-md border px-1 py-0.5 text-[10px] font-medium leading-tight transition-colors ${
                active
                  ? "border-primary bg-selected text-primary"
                  : "border-input-border bg-card text-foreground"
              }`}
            >
              {periodLabel(period, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
