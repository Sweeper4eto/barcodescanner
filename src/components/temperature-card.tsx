"use client";

import { useT } from "@/components/i18n-provider";
import { CheckIcon } from "@/components/app-nav-icons";
import { HubTemperatureIcon } from "@/components/home-hub-icons";
import type { TemperaturePointDto } from "@/lib/temperature";

type Props = {
  point: TemperaturePointDto;
  onOpen: () => void;
  onToggleChecked: () => void;
  /** When false, checkbox is disabled (e.g. future day). */
  canToggle?: boolean;
};

function formatCelsius(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}°`;
}

function rangeCaption(point: TemperaturePointDto): string {
  if (point.minCelsius != null && point.maxCelsius != null) {
    return `${point.minCelsius}–${point.maxCelsius} °C`;
  }
  if (point.minCelsius != null) return `≥ ${point.minCelsius} °C`;
  if (point.maxCelsius != null) return `≤ ${point.maxCelsius} °C`;
  return "";
}

export function TemperatureCard({
  point,
  onOpen,
  onToggleChecked,
  canToggle = true,
}: Props) {
  const { t } = useT();
  const checked = point.completed;
  const reading = formatCelsius(point.celsius);
  const range = rangeCaption(point);
  const warn =
    point.rangeStatus === "high" || point.rangeStatus === "low";

  return (
    <article
      className={`flex w-full overflow-hidden rounded-xl border ${
        checked
          ? warn
            ? "border-warning-fg bg-selected ring-1 ring-warning-fg/40"
            : "border-primary bg-selected ring-1 ring-primary/50"
          : "app-ticket-gradient"
      }`}
    >
      <div
        className={`w-1 shrink-0 self-stretch ${
          checked
            ? warn
              ? "bg-warning-fg"
              : "bg-primary"
            : "bg-card-border"
        }`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1">
        <button
          type="button"
          aria-label={t("temperature.viewPoint")}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left"
          onClick={onOpen}
        >
          <div
            className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border border-card-border bg-zinc-950/60 text-sky-300"
            title={t("temperature.dailyBadge")}
            aria-hidden
          >
            <HubTemperatureIcon className="size-6" />
            <span className="mt-0.5 text-[9px] font-semibold leading-none text-muted">
              {t("temperature.dailyBadge")}
            </span>
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              title={point.title}
              className={`line-clamp-2 break-words text-sm font-semibold leading-tight ${
                checked
                  ? "text-foreground/70 line-through"
                  : "text-foreground"
              }`}
            >
              {point.title}
            </p>
            {checked && point.completedBy ? (
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">
                {t("temperature.doneBy", {
                  name:
                    point.completedBy.displayName?.trim() ||
                    point.completedBy.username,
                })}
              </p>
            ) : range || point.note ? (
              <p
                title={point.note || range}
                className="mt-0.5 truncate text-[10px] leading-tight text-muted"
              >
                {range || point.note}
              </p>
            ) : null}
          </div>
          {reading ? (
            <span
              className={`shrink-0 text-base font-bold tabular-nums ${
                warn ? "text-warning-fg" : "text-foreground"
              }`}
            >
              {reading}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={!canToggle}
          aria-label={
            checked
              ? t("temperature.markNotDone")
              : t("temperature.markDone")
          }
          title={
            checked
              ? t("temperature.markNotDone")
              : t("temperature.markDone")
          }
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40 ${
            checked
              ? "border-primary bg-selected text-primary"
              : "border-muted bg-transparent"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleChecked();
          }}
        >
          {checked ? <CheckIcon className="size-3.5" /> : null}
        </button>
      </div>
    </article>
  );
}
