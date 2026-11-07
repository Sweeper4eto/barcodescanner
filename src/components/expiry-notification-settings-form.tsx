"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CancelButton } from "@/components/cancel-button";
import { LoadingSpinnerPage } from "@/components/loading-spinner";
import { MobilePageHeader, appPageClassName } from "@/components/mobile-page-header";
import { MenuSelect } from "@/components/menu-select";
import { NotifyTimeSelectInline } from "@/components/notify-time-select";
import {
  PushNotifications,
  type PushState,
} from "@/components/push-notifications";
import { useT } from "@/components/i18n-provider";
import { navigateApp } from "@/lib/app-navigation";
import {
  appButtonPrimaryFull,
  appListInset,
  appToggleKnobOff,
  appToggleKnobOn,
  appToggleTrackOff,
  appToggleTrackOn,
} from "@/lib/app-ui";
import type { ExpiryNotificationPrefs } from "@/lib/expiry-notification-prefs";
import {
  expiryNotificationPrefsSchema,
  messageKeyForExpiryPrefsError,
  prefsHaveNoAlertTiers,
  snapTimeToStep,
} from "@/lib/expiry-notification-prefs";
import {
  buildTimezoneOptions,
  detectBrowserTimezone,
  resolveTimezoneForForm,
} from "@/lib/timezones";

type StoreOption = { id: string; name: string };

type SettingsResponse = ExpiryNotificationPrefs & { stores: StoreOption[] };

const DAYS_MIN = 0;
const DAYS_MAX = 90;

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
      className={checked ? appToggleTrackOn : appToggleTrackOff}
    >
      <span
        aria-hidden
        className={checked ? appToggleKnobOn : appToggleKnobOff}
      />
    </button>
  );
}

function clampDays(value: number) {
  if (!Number.isFinite(value)) return DAYS_MIN;
  return Math.min(DAYS_MAX, Math.max(DAYS_MIN, Math.trunc(value)));
}

/** D2: − / editable number / + ; label sits above in the parent grid. */
function DaysStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (days: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(next: number) {
    const clamped = clampDays(next);
    setDraft(String(clamped));
    onChange(clamped);
  }

  return (
    <div className="flex h-8 w-[5.25rem] items-stretch overflow-hidden rounded-lg border border-input-border">
      <button
        type="button"
        aria-label="−"
        disabled={value <= DAYS_MIN}
        className="w-6 shrink-0 text-sm text-muted disabled:opacity-30"
        onClick={() => commit(value - 1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        aria-label={label}
        onChange={(event) => {
          const raw = event.target.value.replace(/\D/g, "");
          if (raw === "") {
            setDraft("");
            return;
          }
          // parseInt drops leading zeros ("02" → 2)
          const next = clampDays(Number.parseInt(raw, 10) || 0);
          setDraft(String(next));
          onChange(next);
        }}
        onBlur={() => commit(Number(draft) || 0)}
        className="min-w-0 flex-1 border-x border-input-border bg-transparent text-center text-xs font-semibold tabular-nums text-foreground outline-none"
      />
      <button
        type="button"
        aria-label="+"
        disabled={value >= DAYS_MAX}
        className="w-6 shrink-0 text-sm text-muted disabled:opacity-30"
        onClick={() => commit(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function FieldColumn({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[0.65rem] font-medium capitalize leading-none text-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

function TierRow({
  title,
  titleClassName,
  enabled,
  onEnabledChange,
  days,
  onDaysChange,
  time,
  onTimeChange,
  daysLabel,
  timeLabel,
}: {
  title: string;
  titleClassName: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  days: number;
  onDaysChange: (days: number) => void;
  time: string;
  onTimeChange: (time: string) => void;
  daysLabel: string;
  timeLabel: string;
}) {
  return (
    <div className="rounded-xl border border-card-border px-2.5 py-2">
      <div className={`flex gap-2 ${enabled ? "items-end" : "items-center"}`}>
        <div
          className={`flex w-[4.25rem] shrink-0 items-center ${
            enabled ? "h-8" : ""
          }`}
        >
          <p
            className={`truncate text-sm font-semibold leading-none ${titleClassName}`}
          >
            {title}
          </p>
        </div>

        {enabled ? (
          <div className="flex min-w-0 flex-1 items-end justify-center gap-2">
            <FieldColumn label={daysLabel}>
              <DaysStepper
                value={days}
                onChange={onDaysChange}
                label={daysLabel}
              />
            </FieldColumn>
            <FieldColumn label={timeLabel}>
              <NotifyTimeSelectInline
                label={timeLabel}
                value={time}
                onChange={onTimeChange}
                className="w-[5.25rem]"
              />
            </FieldColumn>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        {/* Same h-8 as days/time controls so the switch lines up with them. */}
        <div className="flex h-8 shrink-0 items-center">
          <Toggle checked={enabled} onChange={onEnabledChange} label={title} />
        </div>
      </div>
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
  const [pushState, setPushState] = useState<PushState>("loading");

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
      const detected = detectBrowserTimezone();
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
        quietHoursEnabled: false,
        quietHoursStart: next.quietHoursStart,
        quietHoursEnd: next.quietHoursEnd,
        timezone: resolveTimezoneForForm(
          next.customized,
          next.timezone,
          detected,
        ),
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

  const onPushStateChange = useCallback((state: PushState) => {
    setPushState(state);
  }, []);

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

  async function clearBrowserPushSubscription() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => null);
      await subscription.unsubscribe().catch(() => undefined);
    } catch {
      /* server already cleared subscriptions when both tiers are off */
    }
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...prefs,
        schedule: "daily" as const,
        storeIds: storeMode === "all" ? null : prefs.storeIds ?? [],
      };
      const localCheck = expiryNotificationPrefsSchema.safeParse(payload);
      if (!localCheck.success) {
        setError(t(messageKeyForExpiryPrefsError(localCheck.error)));
        return;
      }
      const turningAlertsOff = prefsHaveNoAlertTiers(prefs);
      const response = await fetch("/api/push/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        settings?: SettingsResponse;
        alertsDisabled?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !data?.settings) {
        setError(data?.error ?? t("pushSettings.saveError"));
        return;
      }
      if (turningAlertsOff || data.alertsDisabled) {
        await clearBrowserPushSubscription();
        setMessage(t("pushSettings.savedAlertsOff"));
      } else {
        setMessage(t("pushSettings.saved"));
      }
      setPrefs({ ...data.settings, customized: true });
    } catch {
      setError(t("pushSettings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const detectedTimezone = detectBrowserTimezone();
  const timezoneOptions = useMemo(
    () =>
      prefs
        ? buildTimezoneOptions(
            detectedTimezone,
            prefs.timezone,
            (zone, isDetected) =>
              isDetected ? t("pushSettings.timezoneAuto", { zone }) : zone,
          )
        : [],
    [detectedTimezone, prefs, t],
  );

  /** Prefs stay editable on desktop (no PWA/push). Only a hint when push is off. */
  const pushReady = pushState === "enabled";
  const pushBlocked =
    pushState === "denied" ||
    pushState === "iosNeedsInstall" ||
    pushState === "unconfigured";

  if (loading) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <PushNotifications
          showCustomizeLink={false}
          compact
          onStateChange={onPushStateChange}
        />
        <LoadingSpinnerPage />
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className={appPageClassName}>
        <MobilePageHeader title={t("pushSettings.title")} />
        <PushNotifications
          showCustomizeLink={false}
          compact
          onStateChange={onPushStateChange}
        />
        <p className="mt-3 text-sm text-danger">
          {error || t("pushSettings.loadError")}
        </p>
        <Link href="/app" className="mt-4 inline-block text-sm text-primary">
          ← {t("common.back")}
        </Link>
      </div>
    );
  }

  const chipClass = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-center text-[0.7rem] font-medium ${
      active
        ? "border-primary/45 bg-primary/10 text-primary"
        : "border-card-border text-muted"
    }`;

  return (
    <div className={appPageClassName}>
      <MobilePageHeader title={t("pushSettings.title")} />

      <PushNotifications
        showCustomizeLink={false}
        compact
        onStateChange={onPushStateChange}
      />

      <div className={`mt-2 space-y-2 pb-8 ${appListInset}`}>
        {!pushReady && pushState !== "loading" ? (
          <p className="rounded-xl border border-dashed border-card-border px-3 py-2 text-xs leading-snug text-muted">
            {pushBlocked
              ? t("pushSettings.pushOffHint")
              : t("pushSettings.desktopEditHint")}
          </p>
        ) : null}

        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
          {t("pushSettings.tiers")}
        </p>
        <div className="space-y-1.5">
          <TierRow
            title={t("pushSettings.urgentTitle")}
            titleClassName="text-danger"
            enabled={prefs.urgentEnabled}
            onEnabledChange={(urgentEnabled) => patch({ urgentEnabled })}
            days={prefs.urgentDays}
            onDaysChange={(urgentDays) => patch({ urgentDays })}
            time={prefs.time2}
            onTimeChange={(time2) => patch({ time2: snapTimeToStep(time2) })}
            daysLabel={t("pushSettings.daysLabel")}
            timeLabel={t("pushSettings.timeLabel")}
          />
          <TierRow
            title={t("pushSettings.earlyTitle")}
            titleClassName="text-primary"
            enabled={prefs.earlyEnabled}
            onEnabledChange={(earlyEnabled) => patch({ earlyEnabled })}
            days={prefs.earlyDays}
            onDaysChange={(earlyDays) => patch({ earlyDays })}
            time={prefs.time1}
            onTimeChange={(time1) => patch({ time1: snapTimeToStep(time1) })}
            daysLabel={t("pushSettings.daysLabel")}
            timeLabel={t("pushSettings.timeLabel")}
          />
        </div>

        <p className="pt-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
          {t("pushSettings.general")}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-card-border px-2.5 py-2">
            <p className="shrink-0 text-sm font-semibold text-foreground">
              {t("pushSettings.timezone")}
            </p>
            <div className="min-w-0 max-w-[14rem] flex-1">
              <MenuSelect
                size="compact"
                label={t("pushSettings.timezone")}
                value={prefs.timezone}
                options={timezoneOptions}
                onChange={(timezone) => patch({ timezone })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-card-border px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {t("pushSettings.stores")}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setStoreMode("all")}
                  className={chipClass(storeMode === "all")}
                >
                  {t("pushSettings.storesAllShort")}
                </button>
                <button
                  type="button"
                  onClick={() => setStoreMode("selected")}
                  className={chipClass(storeMode === "selected")}
                >
                  {t("pushSettings.storesSelectedShort")}
                </button>
              </div>
            </div>
            {storeMode === "selected" ? (
              <ul className="mt-2 space-y-1.5 border-t border-card-border pt-2">
                {stores.map((store) => {
                  const checked = prefs.storeIds?.includes(store.id) ?? false;
                  return (
                    <li key={store.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStore(store.id)}
                          className="size-3.5 accent-primary"
                        />
                        {store.name}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className={`${appButtonPrimaryFull} !h-9 !rounded-lg !py-0 !text-sm`}
        >
          {saving ? t("admin.saving") : t("pushSettings.save")}
        </button>
        <CancelButton onClick={() => navigateApp("/app")}>
          {t("common.cancel")}
        </CancelButton>
      </div>
    </div>
  );
}
