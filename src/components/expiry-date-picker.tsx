"use client";

import { useT } from "@/components/i18n-provider";

export function expiryDateBounds(): { min: string; max: string } {
  const today = new Date();
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 1);

  const toInput = (date: Date) => date.toISOString().slice(0, 10);
  return { min: toInput(today), max: toInput(max) };
}

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ExpiryDatePicker({ value, onChange }: Props) {
  const { t } = useT();
  const { min, max } = expiryDateBounds();

  return (
    <label className="block text-sm font-medium text-foreground">
      {t("expiry.dateLabel")}
      <input
        type="date"
        className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-foreground"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}
