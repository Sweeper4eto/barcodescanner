"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useT } from "@/components/i18n-provider";
import {
  formatYmdAsDmy,
  parseFlexibleExpiryInput,
  parseYmdLocal,
  toYmdLocal,
} from "@/lib/expiry-date-input";
import { expiryDateBounds } from "@/lib/expiry-date-bounds";

export {
  EXPIRY_PICKER_YEARS_AHEAD,
  EXPIRY_PICKER_YEARS_PAST,
  expiryDateBounds,
} from "@/lib/expiry-date-bounds";
export { parseFlexibleExpiryInput } from "@/lib/expiry-date-input";

function startWeekdayMonday(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export type ExpiryDatePickerHandle = {
  /** Apply any in-progress typed date; returns the effective YYYY-MM-DD (or null). */
  flush: () => string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** When true, dates up to 3 years in the past can be selected (edit/OCR correction). */
  allowPast?: boolean;
};

export const ExpiryDatePicker = forwardRef<ExpiryDatePickerHandle, Props>(
  function ExpiryDatePicker({ value, onChange, allowPast = false }, ref) {
    const { t, monthName } = useT();
    const { min, max } = expiryDateBounds(allowPast);
    const minDate = useMemo(() => parseYmdLocal(min)!, [min]);
    const maxDate = useMemo(() => parseYmdLocal(max)!, [max]);

    const selected = value ? parseYmdLocal(value) : null;
    const initial = selected ?? (allowPast ? new Date() : minDate);

    const [viewYear, setViewYear] = useState(initial.getFullYear());
    const [viewMonth, setViewMonth] = useState(initial.getMonth());
    const [typed, setTyped] = useState(() =>
      value ? formatYmdAsDmy(value) : "",
    );
    const [typedError, setTypedError] = useState(false);

    useEffect(() => {
      if (!value) {
        setTyped("");
        setTypedError(false);
        return;
      }
      const parsed = parseYmdLocal(value);
      if (!parsed) return;
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setTyped(formatYmdAsDmy(value));
      setTypedError(false);
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

    function clampToBounds(ymd: string): string | null {
      const date = parseYmdLocal(ymd);
      if (!date) return null;
      if (date < minDate || date > maxDate) return null;
      return ymd;
    }

    function clampDate(date: Date): Date {
      if (date < minDate) return new Date(minDate);
      if (date > maxDate) return new Date(maxDate);
      return date;
    }

    function monthIsSelectable(year: number, month: number): boolean {
      const first = new Date(year, month, 1);
      const last = new Date(year, month, daysInMonth(year, month));
      return last >= minDate && first <= maxDate;
    }

    function isDayDisabled(year: number, month: number, day: number): boolean {
      const date = new Date(year, month, day);
      return date < minDate || date > maxDate;
    }

    /** Commit year/month/day immediately (used by calendar + month/year selects). */
    function commitYmd(year: number, month: number, day: number) {
      const dim = daysInMonth(year, month);
      const safeDay = Math.min(Math.max(1, day), dim);
      const next = clampDate(new Date(year, month, safeDay));
      const ymd = toYmdLocal(next);
      onChange(ymd);
      return ymd;
    }

    function selectDay(day: number) {
      if (isDayDisabled(viewYear, viewMonth, day)) return;
      commitYmd(viewYear, viewMonth, day);
    }

    function onMonthChange(nextMonth: number) {
      setViewMonth(nextMonth);
      const dayHint = selected?.getDate() ?? 1;
      commitYmd(viewYear, nextMonth, dayHint);
    }

    function onYearChange(nextYear: number) {
      let month = viewMonth;
      if (nextYear === minYear && month < minDate.getMonth()) {
        month = minDate.getMonth();
      }
      if (nextYear === maxYear && month > maxDate.getMonth()) {
        month = maxDate.getMonth();
      }
      setViewYear(nextYear);
      setViewMonth(month);
      const dayHint = selected?.getDate() ?? 1;
      commitYmd(nextYear, month, dayHint);
    }

    function tryParseTyped(raw: string): string | null {
      const parsed = parseFlexibleExpiryInput(raw);
      if (!parsed) return null;
      return clampToBounds(parsed);
    }

    function applyTyped(): string | null {
      const raw = typed.trim();
      if (!raw) {
        setTypedError(false);
        return value && parseYmdLocal(value) ? value : null;
      }
      const bounded = tryParseTyped(raw);
      if (!bounded) {
        setTypedError(true);
        return null;
      }
      setTypedError(false);
      onChange(bounded);
      return bounded;
    }

    useImperativeHandle(ref, () => ({
      flush: () => {
        const raw = typed.trim();
        if (!raw) {
          return value && parseYmdLocal(value) ? value : null;
        }
        const bounded = tryParseTyped(raw);
        if (!bounded) {
          setTypedError(true);
          return null;
        }
        setTypedError(false);
        onChange(bounded);
        return bounded;
      },
    }));

    const weekdayLabels = t("expiry.weekdays").split(",");

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t("expiry.dateLabel")}
        </p>

        <label className="block text-xs text-muted">
          {t("expiry.dateTypeHint")}
          <div className="mt-0.5 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("expiry.dateTypePlaceholder")}
              className={`min-w-0 flex-1 rounded-lg border bg-card px-2 py-1.5 font-mono text-sm tabular-nums text-foreground ${
                typedError ? "border-danger-border" : "border-input-border"
              }`}
              value={typed}
              onChange={(event) => {
                const next = event.target.value;
                setTyped(next);
                setTypedError(false);
                // Commit as soon as DD.MM.YYYY (or ISO) is complete & valid.
                const bounded = tryParseTyped(next);
                if (bounded) onChange(bounded);
              }}
              onBlur={() => {
                if (typed.trim()) applyTyped();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyTyped();
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg border border-input-border bg-card px-3 py-1.5 text-sm font-medium text-foreground"
              onClick={() => applyTyped()}
            >
              {t("expiry.dateTypeApply")}
            </button>
          </div>
          {typedError ? (
            <span className="mt-1 block text-[11px] text-error">
              {t("expiry.dateTypeInvalid")}
            </span>
          ) : null}
        </label>

        <div className="rounded-xl border border-input-border bg-input p-2">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              {t("expiry.monthLabel")}
              <select
                className="mt-0.5 w-full rounded-lg border border-input-border bg-card px-2 py-1.5 text-sm text-foreground"
                value={viewMonth}
                onChange={(event) =>
                  onMonthChange(Number(event.target.value))
                }
              >
                {monthOptions.map((month) => (
                  <option
                    key={month}
                    value={month}
                    disabled={!monthIsSelectable(viewYear, month)}
                  >
                    {`${monthName(month + 1)} / ${String(month + 1).padStart(2, "0")}`}
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
  },
);
