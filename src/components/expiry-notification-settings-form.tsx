"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader, appPageClassName } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import {
  appButtonPrimaryFull,
  appFormInput,
} from "@/lib/app-ui";
import type { ExpiryNotificationPrefs, NotifySchedule } from "@/lib/expiry-notification-prefs";

type StoreOption = { id: string; name: string };

type SettingsResponse = ExpiryNotificationPrefs & { stores: StoreOption[] };

const DAY_PRESETS = [0, 1, 3, 7, 14, 21] as const;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "border border-card-border bg-transparent"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
          checked ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Section({
  title,
  tag,
  hint,
  children,
}: {
  title: string;
  tag?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-card-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {tag ? (
          <span className="rounded-full border border-primary/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            {tag}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mb-3 text-xs leading-snug text-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

function DayChips({
  value,
  onChange,
  presets,
  customLabel,
  daysLabel,
}: {
  value: number;
  onChange: (days: number) => void;
  presets: readonly number[];
  customLabel: string;
  daysLabel: string;
}) {
  const [custom, setCustom] = useState(!presets.includes(value as (typeof presets)[number]));

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {presets.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => {
            setCustom(false);
            onChange(days);
          }}
          className={`rounded-full border px-3 py-1.5 text-xs ${
            !custom && value === days
              ? "border-primary/45 bg-primary/10 text-primary"
              : "border-card-border text-muted"
          }`}
        >
          {days === 0 ? "0" : `${days} ${daysLabel}`}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCustom(true)}
        className={`rounded-full border px-3 py-1.5 text-xs ${
          custom ? "border-primary/45 bg-primary/10 text-primary" : "border-card-border text-muted"
        }`}
      >
        {customLabel}
      </button>
      {custom ? (
        <input
          type="number"
          min={0}
          max={90}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${appFormInput} w-20 px-2 py-1.5 text-center text-sm`}
        />
      ) : null}
    </div>
  );
}

export function ExpiryNotificationSettingsForm() {
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [prefs, setPrefs] = useState<ExpiryNotificationPrefs | null>(null);
  const [storeMode, setStoreMode] = useState<"all" | "selected">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/push/notification-settings");
      const data = (await response.json().catch(() => null)) as {
        settings?: SettingsResponse;
        error?: string;
      } | null;
      if (!response.ok || !data?.settings) {
        setError(data?.error ?? t("pushSettings.loadError"));
        return;
      }
      const next = data.settings;
      setStores(next.stores);
      setPrefs({
        earlyEnabled: next.earlyEnabled,
        earlyDays: next.earlyDays,
        urgentEnabled: next.urgentEnabled,
        urgentDays: next.urgentDays,
        schedule: next.schedule,
        time1: next.time1,
        time2: next.time2,
        minIntervalHours: next.minIntervalHours,
        quietHoursEnabled: next.quietHoursEnabled,
        quietHoursStart: next.quietHoursStart,
        quietHoursEnd: next.quietHoursEnd,
        timezone: next.timezone,
        storeIds: next.storeIds,
        customized: next.customized,
      });
      setStoreMode(next.storeIds && next.storeIds.length > 0 ? "selected" : "all");
    } catch {
      setError(t("pushSettings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(partial: Partial<ExpiryNotificationPrefs>) {
    setPrefs((current) => (current ? { ...current, ...partial } : current));
  }

  function toggleStore(id: string) {
    setPrefs((current) => {
      if (!current) return current;
      const selected = new Set(current.storeIds ?? []);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return { ...current, storeIds: [...selected] };
    });
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...prefs,
        storeIds: storeMode === "all" ? null : prefs.storeIds ?? [],
      };
      const response = await fetch("/api/push/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        settings?: SettingsResponse;
        error?: string;
      } | null;
      if (!response.ok || !data?.settings) {
        setError(data?.error ?? t("pushSettings.saveError"));
        return;
      }
      setMessage(t("pushSettings.saved"));
      setPrefs({ ...data.settings, customized: true });
    } catch {
      setError(t("pushSettings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <LoadingSpinnerBlock />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <p className="text-sm text-danger">{error || t("pushSettings.loadError")}</p>
        <Link href="/app" className="mt-4 inline-block text-sm text-primary">
          ← {t("common.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className={appPageClassName}>
      <MobilePageHeader
        title={t("pushSettings.title")}
        action={
          <Link href="/app" className="text-sm text-primary">
            {t("common.back")}
          </Link>
        }
      />

      <div className="space-y-3 pb-8">
        <Section title={t("pushSettings.tiers")} tag="Phase 3" hint={t("pushSettings.tiersHint")}>
          <div className="rounded-xl border border-yellow-500/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-yellow-200/90">{t("pushSettings.earlyTitle")}</p>
              </div>
              <Toggle
                checked={prefs.earlyEnabled}
                onChange={(earlyEnabled) => patch({ earlyEnabled })}
                label={t("pushSettings.earlyTitle")}
              />
            </div>
            <DayChips
              value={prefs.earlyDays}
              onChange={(earlyDays) => patch({ earlyDays })}
              presets={[1, 3, 7, 14, 21]}
              customLabel={t("pushSettings.customDays")}
              daysLabel={t("pushSettings.daysLabel")}
            />
          </div>

          <div className="mt-3 rounded-xl border border-red-400/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-red-200/90">{t("pushSettings.urgentTitle")}</p>
              </div>
              <Toggle
                checked={prefs.urgentEnabled}
                onChange={(urgentEnabled) => patch({ urgentEnabled })}
                label={t("pushSettings.urgentTitle")}
              />
            </div>
            <DayChips
              value={prefs.urgentDays}
              onChange={(urgentDays) => patch({ urgentDays })}
              presets={DAY_PRESETS}
              customLabel={t("pushSettings.customDays")}
              daysLabel={t("pushSettings.daysLabel")}
            />
          </div>
        </Section>

        <Section title={t("pushSettings.schedule")}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["daily", t("pushSettings.frequencyDaily")],
                ["twice_daily", t("pushSettings.frequencyTwice")],
                ["custom", t("pushSettings.frequencyCustom")],
              ] as const
            ).map(([schedule, label]) => (
              <button
                key={schedule}
                type="button"
                onClick={() => patch({ schedule: schedule as NotifySchedule })}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  prefs.schedule === schedule
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : "border-card-border text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {prefs.schedule !== "custom" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-muted">
                {t("pushSettings.timeLabel")}
                <input
                  type="time"
                  value={prefs.time1}
                  onChange={(event) => patch({ time1: event.target.value })}
                  className={`${appFormInput} mt-1 block`}
                />
              </label>
              {prefs.schedule === "twice_daily" ? (
                <label className="text-xs text-muted">
                  {t("pushSettings.timeSecond")}
                  <input
                    type="time"
                    value={prefs.time2}
                    onChange={(event) => patch({ time2: event.target.value })}
                    className={`${appFormInput} mt-1 block`}
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted">{t("pushSettings.minInterval")}</span>
              <input
                type="number"
                min={6}
                max={168}
                value={prefs.minIntervalHours}
                onChange={(event) =>
                  patch({ minIntervalHours: Number(event.target.value) })
                }
                className={`${appFormInput} w-20 px-2 py-1.5 text-center`}
              />
              <span className="text-muted">{t("pushSettings.hours")}</span>
            </div>
          )}

          <label className="mt-3 block text-xs text-muted">
            {t("pushSettings.timezone")}
            <input
              type="text"
              value={prefs.timezone}
              onChange={(event) => patch({ timezone: event.target.value })}
              className={`${appFormInput} mt-1 block w-full`}
            />
          </label>
        </Section>

        <Section
          title={t("pushSettings.quietHours")}
          tag="Phase 3"
          hint={t("pushSettings.quietHoursHint")}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">{t("pushSettings.quietEnabled")}</p>
            <Toggle
              checked={prefs.quietHoursEnabled}
              onChange={(quietHoursEnabled) => patch({ quietHoursEnabled })}
              label={t("pushSettings.quietEnabled")}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs text-muted">
              {t("pushSettings.quietFrom")}
              <input
                type="time"
                value={prefs.quietHoursStart}
                onChange={(event) => patch({ quietHoursStart: event.target.value })}
                className={`${appFormInput} mt-1 block`}
              />
            </label>
            <label className="text-xs text-muted">
              {t("pushSettings.quietTo")}
              <input
                type="time"
                value={prefs.quietHoursEnd}
                onChange={(event) => patch({ quietHoursEnd: event.target.value })}
                className={`${appFormInput} mt-1 block`}
              />
            </label>
          </div>
        </Section>

        <Section title={t("pushSettings.stores")}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStoreMode("all")}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                storeMode === "all"
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-card-border text-muted"
              }`}
            >
              {t("pushSettings.storesAll")}
            </button>
            <button
              type="button"
              onClick={() => setStoreMode("selected")}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                storeMode === "selected"
                  ? "border-primary/45 bg-primary/10 text-primary"
                  : "border-card-border text-muted"
              }`}
            >
              {t("pushSettings.storesSelected")}
            </button>
          </div>
          {storeMode === "selected" ? (
            <ul className="mt-3 space-y-2">
              {stores.map((store) => {
                const checked = prefs.storeIds?.includes(store.id) ?? false;
                return (
                  <li key={store.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStore(store.id)}
                        className="size-4 accent-primary"
                      />
                      {store.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Section>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className={appButtonPrimaryFull}
        >
          {saving ? t("admin.saving") : t("pushSettings.save")}
        </button>
      </div>
    </div>
  );
}
