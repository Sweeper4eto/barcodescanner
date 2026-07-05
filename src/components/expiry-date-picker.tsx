"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/i18n-provider";

export const EXPIRY_PICKER_YEARS_AHEAD = 5;

export function expiryDateBounds(): { min: string; max: string } {
  const today = new Date();
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + EXPIRY_PICKER_YEARS_AHEAD);

  const toInput = (date: Date) => date.toISOString().slice(0, 10);
  return { min: toInput(today), max: toInput(max) };
}

function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startWeekdayMonday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function ExpiryDatePicker({ value, onChange }: Props) {
  const { t, monthName } = useT();
  const { min, max } = expiryDateBounds();
  const minDate = useMemo(() => parseYmd(min)!, [min]);
  const maxDate = useMemo(() => parseYmd(max)!, [max]);

  const selected = value ? parseYmd(value) : null;
  const initial = selected ?? minDate;

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (!value) return;
    const parsed = parseYmd(value);
    if (!parsed) return;
    setViewYear(parsed.getFullYear());
    setViewMonth(parsed.getMonth());
  }, [value]);

  const minYear = minDate.getFullYear();
  const maxYear = maxDate.getFullYear();
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, index) => minYear + index,
  );

  const monthOptions = Array.from({ length: 12 }, (_, month) => month);
  const leadingBlanks = startWeekdayMonday(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const dayCells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  function monthIsSelectable(year: number, month: number): boolean {
    const first = new Date(year, month, 1);
    const last = new Date(year, month, daysInMonth(year, month));
    return last >= minDate && first <= maxDate;
  }

  function isDayDisabled(year: number, month: number, day: number): boolean {
    const date = new Date(year, month, day);
    return date < minDate || date > maxDate;
  }

  function selectDay(day: number) {
    if (isDayDisabled(viewYear, viewMonth, day)) return;
    onChange(toYmd(new Date(viewYear, viewMonth, day)));
  }

  function onMonthChange(nextMonth: number) {
    setViewMonth(nextMonth);
  }

  function onYearChange(nextYear: number) {
    setViewYear(nextYear);
    if (nextYear === minYear && viewMonth < minDate.getMonth()) {
      setViewMonth(minDate.getMonth());
    }
    if (nextYear === maxYear && viewMonth > maxDate.getMonth()) {
      setViewMonth(maxDate.getMonth());
    }
  }

  const weekdayLabels =
    t("expiry.weekdays").split(",");

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{t("expiry.dateLabel")}</p>

      <div className="rounded-xl border border-input-border bg-input p-2">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="block text-xs text-muted">
            {t("expiry.monthLabel")}
            <select
              className="mt-0.5 w-full rounded-lg border border-input-border bg-card px-2 py-1.5 text-sm text-foreground"
              value={viewMonth}
              onChange={(event) => onMonthChange(Number(event.target.value))}
            >
              {monthOptions.map((month) => (
                <option
                  key={month}
                  value={month}
                  disabled={!monthIsSelectable(viewYear, month)}
                >
                  {monthName(month + 1)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            {t("expiry.yearLabel")}
            <select
              className="mt-0.5 w-full rounded-lg border border-input-border bg-card px-2 py-1.5 text-sm text-foreground"
              value={viewYear}
              onChange={(event) => onYearChange(Number(event.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted">
          {weekdayLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {dayCells.map((day, index) =>
            day === null ? (
              <span key={`blank-${index}`} aria-hidden />
            ) : (
              <button
                key={`${viewYear}-${viewMonth}-${day}`}
                type="button"
                disabled={isDayDisabled(viewYear, viewMonth, day)}
                className={`rounded-md py-1 text-xs font-medium tabular-nums disabled:opacity-30 ${
                  selected &&
                  selected.getFullYear() === viewYear &&
                  selected.getMonth() === viewMonth &&
                  selected.getDate() === day
                    ? "bg-primary text-primary-fg"
                    : "text-foreground hover:bg-subtle"
                }`}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
