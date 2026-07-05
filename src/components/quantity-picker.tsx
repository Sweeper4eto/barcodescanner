"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: number;
};

export function QuantityPicker({ value, onChange, max = 20 }: Props) {
  const { t } = useT();
  const [gridOpen, setGridOpen] = useState(true);

  useEffect(() => {
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed) || parsed < 1) {
      setGridOpen(true);
    }
  }, [value]);

  function pick(next: number) {
    onChange(String(next));
    setGridOpen(false);
  }

  function onManualChange(raw: string) {
    onChange(raw.replace(/[^\d]/g, ""));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{t("scan.itemsHeader")}</p>

      {!gridOpen ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("scan.changeQuantity")}
            className="flex h-10 min-w-12 items-center justify-center rounded-lg border border-primary bg-selected px-3 text-lg font-bold tabular-nums text-primary"
            onClick={() => setGridOpen(true)}
          >
            {value}
          </button>
          <input
            className="min-w-0 flex-1 rounded-lg border border-input-border bg-input px-3 py-2 text-base text-foreground"
            inputMode="numeric"
            value={value}
            onChange={(event) => onManualChange(event.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {Array.from({ length: max }, (_, index) => index + 1).map((amount) => (
              <button
                key={amount}
                type="button"
                className={`min-w-0 rounded-md border px-0.5 py-1 text-xs font-medium tabular-nums ${
                  value === String(amount)
                    ? "border-primary bg-selected text-primary"
                    : "border-input-border bg-card text-foreground"
                }`}
                onClick={() => pick(amount)}
              >
                {amount}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-lg border border-input-border bg-input px-3 py-2 text-base text-foreground"
            inputMode="numeric"
            placeholder={t("scan.manualQuantity")}
            value={value}
            onChange={(event) => onManualChange(event.target.value)}
          />
        </>
      )}
    </div>
  );
}
