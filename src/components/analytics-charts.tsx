"use client";

import type { ReactNode } from "react";

export function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-card-border bg-card px-3 py-3">
      <header className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const valueClass =
    tone === "warn"
      ? "text-warning-fg"
      : tone === "danger"
        ? "text-danger"
        : tone === "ok"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-card-border bg-transparent px-2.5 py-2">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Side-by-side compare bars (e.g. this week vs prior). */
export function CompareBars({
  rows,
}: {
  rows: Array<{
    label: string;
    current: number;
    prior: number;
    currentLabel: string;
    priorLabel: string;
  }>;
}) {
  const max = Math.max(
    1,
    ...rows.flatMap((row) => [row.current, row.prior]),
  );
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label}>
          <p className="mb-1.5 text-xs font-medium text-muted">{row.label}</p>
          <div className="space-y-1.5">
            <BarRow
              label={row.currentLabel}
              value={row.current}
              max={max}
              color="var(--primary)"
            />
            <BarRow
              label={row.priorLabel}
              value={row.prior}
              max={max}
              color="var(--card-border)"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[0.65rem] text-muted">{label}</span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

/** Vertical day bars for the last N days. */
export function DayBars({
  days,
  emptyLabel,
}: {
  days: Array<{ date: string; qty: number }>;
  emptyLabel: string;
}) {
  if (days.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...days.map((d) => d.qty));
  const height = 88;
  return (
    <div>
      <div
        className="flex items-end gap-1"
        style={{ height }}
        role="img"
        aria-label="Write-off by day"
      >
        {days.map((day) => {
          const barH =
            day.qty <= 0 ? 3 : Math.max(6, Math.round((day.qty / max) * height));
          return (
            <div
              key={day.date}
              className="flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${day.date}: ${day.qty}`}
            >
              <span className="mb-0.5 text-[0.6rem] tabular-nums text-muted">
                {day.qty > 0 ? day.qty : ""}
              </span>
              <div
                className={`w-full max-w-[14px] rounded-t-sm ${
                  day.qty > 0 ? "bg-primary/80" : "bg-zinc-700/80"
                }`}
                style={{ height: barH }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.6rem] text-muted">
        <span>{days[0]?.date.slice(5)}</span>
        <span>{days[days.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

/** Horizontal ranked bars (stores / staff / products). */
export function RankBars({
  rows,
  emptyLabel,
  highlight,
  onSelect,
  selectHint,
}: {
  rows: Array<{ id: string; label: string; value: number; hint?: string }>;
  emptyLabel: string;
  highlight?: (row: { id: string; value: number }) => boolean;
  onSelect?: (id: string) => void;
  selectHint?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const pct = Math.max(3, Math.round((row.value / max) * 100));
        const hot = highlight?.(row) ?? false;
        const inner = (
          <>
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {row.label}
                {hot ? (
                  <span className="ml-1.5 text-[0.65rem] font-semibold text-warning-fg">
                    ▲
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                {row.value}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className={`h-full rounded-full ${
                  hot ? "bg-warning-fg/80" : "bg-primary/75"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {row.hint ? (
              <p className="mt-0.5 text-[0.65rem] text-muted">{row.hint}</p>
            ) : null}
          </>
        );
        return (
          <li key={row.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                className="w-full rounded-lg border border-transparent px-0.5 py-0.5 text-left transition-colors hover:border-primary/35"
                title={selectHint}
              >
                {inner}
              </button>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 14-day coverage strip. */
export function CoverageStrip({
  days,
  legendOk,
  legendGap,
  legendQuiet,
}: {
  days: Array<{ date: string; gap: boolean; checked: boolean; dueCount: number }>;
  legendOk: string;
  legendGap: string;
  legendQuiet: string;
}) {
  if (days.length === 0) return null;
  return (
    <div>
      <div className="flex gap-1">
        {days.map((day) => {
          const tone = day.gap
            ? "bg-danger/80"
            : day.checked
              ? "bg-primary/70"
              : "bg-zinc-700/80";
          return (
            <div
              key={day.date}
              className={`h-7 min-w-0 flex-1 rounded-md ${tone}`}
              title={`${day.date}: due ${day.dueCount}${
                day.gap ? " · gap" : day.checked ? " · checked" : ""
              }`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-primary/70" />
          {legendOk}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-danger/80" />
          {legendGap}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-zinc-700/80" />
          {legendQuiet}
        </span>
      </div>
    </div>
  );
}

export function SegmentTabs({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-card-border p-1">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold ${
              active
                ? "border border-primary text-primary"
                : "border border-transparent text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
