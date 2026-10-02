"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import {
  appButtonNeutral,
  appButtonPrimary,
  appButtonPrimaryFull,
  appChromeInset,
  appFooterButtonGrid,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import {
  SCHEDULE_CLOSE_MIN,
  SCHEDULE_OPEN_MIN,
  SCHEDULE_SPAN_MIN,
  SCHEDULE_STEP_MIN,
  addDaysYmd,
  formatMinutesAsClock,
  mondayOfWeek,
  parseYmd,
} from "@/lib/schedule";

type Staff = { id: string; username: string; clientRole: string | null };
type Pref = {
  id: string;
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};
type Shift = {
  id: string;
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};
type WeekPayload = {
  week: {
    id: string;
    storeId: string;
    weekStart: string;
    mode: "auto" | "manual";
    status: "DRAFT" | "FINALIZED";
    finalizedAt: string | null;
  };
  staff: Staff[];
  preferences: Pref[];
  shifts: Shift[];
  me: { userId: string; isOwner: boolean };
};

const DAY_LABELS = [
  "schedule.dayMon",
  "schedule.dayTue",
  "schedule.dayWed",
  "schedule.dayThu",
  "schedule.dayFri",
  "schedule.daySat",
  "schedule.daySun",
] as const;


function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

function leftPct(startMin: number): number {
  return ((startMin - SCHEDULE_OPEN_MIN) / SCHEDULE_SPAN_MIN) * 100;
}

function widthPct(startMin: number, endMin: number): number {
  return ((endMin - startMin) / SCHEDULE_SPAN_MIN) * 100;
}

function RangeSlider({
  startMin,
  endMin,
  disabled,
  onChange,
}: {
  startMin: number;
  endMin: number;
  disabled?: boolean;
  onChange: (start: number, end: number) => void;
}) {
  const min = SCHEDULE_OPEN_MIN;
  const max = SCHEDULE_CLOSE_MIN;
  const step = SCHEDULE_STEP_MIN;

  return (
    <div className="space-y-3">
      <p className="text-center text-lg font-semibold tabular-nums text-foreground">
        {formatMinutesAsClock(startMin)} – {formatMinutesAsClock(endMin)}
      </p>
      <label className="block text-xs text-muted">
        {formatMinutesAsClock(min)} → {formatMinutesAsClock(max)}
        <input
          type="range"
          min={min}
          max={max - step}
          step={step}
          value={startMin}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(next, Math.max(next + step, endMin));
          }}
          className="mt-2 w-full accent-primary"
        />
      </label>
      <label className="block text-xs text-muted">
        End
        <input
          type="range"
          min={min + step}
          max={max}
          step={step}
          value={endMin}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Math.min(startMin, next - step), next);
          }}
          className="mt-2 w-full accent-primary"
        />
      </label>
    </div>
  );
}

function SchedulePageInner() {
  const { t, locale } = useT();
  const { storeId, ready: storeReady } = useAppStoreId();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [dayIndex, setDayIndex] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [data, setData] = useState<WeekPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desireStart, setDesireStart] = useState(10 * 60);
  const [desireEnd, setDesireEnd] = useState(16 * 60);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/schedule?storeId=${encodeURIComponent(storeId)}&weekStart=${encodeURIComponent(weekStart)}`,
      );
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.loadFailed"));
        setData(null);
        return;
      }
      setData(json);
      const mine = json.preferences.find(
        (p) => p.userId === json.me.userId && p.dayIndex === dayIndex,
      );
      if (mine) {
        setDesireStart(mine.startMin);
        setDesireEnd(mine.endMin);
      }
    } catch {
      setError(t("schedule.loadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId, weekStart, dayIndex, t]);

  useEffect(() => {
    if (!storeReady || !storeId) return;
    void load();
  }, [storeReady, storeId, load]);

  useEffect(() => {
    if (!data) return;
    const mine = data.preferences.find(
      (p) => p.userId === data.me.userId && p.dayIndex === dayIndex,
    );
    if (mine) {
      setDesireStart(mine.startMin);
      setDesireEnd(mine.endMin);
    } else {
      setDesireStart(10 * 60);
      setDesireEnd(16 * 60);
    }
  }, [data, dayIndex]);

  const dayShifts = useMemo(
    () =>
      (data?.shifts ?? [])
        .filter((s) => s.dayIndex === dayIndex)
        .sort((a, b) => a.startMin - b.startMin),
    [data, dayIndex],
  );

  const locked = data?.week.status === "FINALIZED";
  const isOwner = Boolean(data?.me.isOwner);

  async function ownerAction(
    action: "setMode" | "runAuto" | "finalize" | "reopen",
    mode?: "auto" | "manual",
  ) {
    if (!storeId || !data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, weekStart, action, mode }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.saveFailed"));
        return;
      }
      setData(json);
    } catch {
      setError(t("schedule.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveDesire() {
    if (!storeId || !data || locked) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          weekStart,
          dayIndex,
          startMin: desireStart,
          endMin: desireEnd,
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.saveFailed"));
        return;
      }
      setData(json);
    } catch {
      setError(t("schedule.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function nudgeShift(shift: Shift, edge: "start" | "end", delta: number) {
    if (!storeId || !data || !isOwner || locked) return;
    const next = data.shifts.map((s) => {
      if (s.id !== shift.id) return s;
      if (edge === "start") {
        return {
          ...s,
          startMin: Math.min(
            s.endMin - SCHEDULE_STEP_MIN,
            Math.max(SCHEDULE_OPEN_MIN, s.startMin + delta),
          ),
        };
      }
      return {
        ...s,
        endMin: Math.max(
          s.startMin + SCHEDULE_STEP_MIN,
          Math.min(SCHEDULE_CLOSE_MIN, s.endMin + delta),
        ),
      };
    });
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          weekStart,
          action: "setShifts",
          shifts: next.map(({ userId, dayIndex: d, startMin, endMin }) => ({
            userId,
            dayIndex: d,
            startMin,
            endMin,
          })),
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("schedule.overlapOrBounds"));
        return;
      }
      setData(json);
    } catch {
      setError(t("schedule.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const weekLabel = useMemo(() => {
    const start = parseYmd(weekStart);
    const end = parseYmd(addDaysYmd(weekStart, 6));
    const fmt = new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }, [weekStart, locale]);

  if (!storeReady) {
    return <LoadingSpinnerBlock wrapperClassName="flex justify-center py-10" />;
  }

  if (!storeId) {
    return (
      <div className={`${appPageShell} ${appChromeInset} py-6`}>
        <MobilePageHeader title={t("schedule.title")} />
        <p className="mt-4 text-sm text-muted">{t("app.noStores")}</p>
      </div>
    );
  }

  return (
    <div className={`${appPageShell} flex min-h-0 flex-1 flex-col pb-8`}>
      <div className={appChromeInset}>
        <MobilePageHeader title={t("schedule.title")} />
        <p className="mt-1 text-sm text-muted">
          {t("schedule.hoursHint")} · {weekLabel}
        </p>
      </div>

      <div className={`${appListInset} mt-3 space-y-3`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={appButtonNeutral}
            onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${appButtonNeutral} flex-1`}
            onClick={() => setWeekStart(mondayOfWeek())}
          >
            {t("schedule.thisWeek")}
          </button>
          <button
            type="button"
            className={appButtonNeutral}
            onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}
          >
            ›
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {DAY_LABELS.map((key, idx) => {
            const active = idx === dayIndex;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDayIndex(idx)}
                className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-primary bg-selected text-primary"
                    : "border-card-border text-muted"
                }`}
              >
                {t(key)}
              </button>
            );
          })}
        </div>

        {isOwner ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || locked}
              className={`${appButtonNeutral} ${
                data?.week.mode === "auto" ? "border-primary text-primary" : ""
              }`}
              onClick={() => void ownerAction("setMode", "auto")}
            >
              {t("schedule.modeAuto")}
            </button>
            <button
              type="button"
              disabled={saving || locked}
              className={`${appButtonNeutral} ${
                data?.week.mode === "manual" ? "border-primary text-primary" : ""
              }`}
              onClick={() => void ownerAction("setMode", "manual")}
            >
              {t("schedule.modeManual")}
            </button>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                locked
                  ? "border-primary/45 text-primary"
                  : "border-card-border text-muted"
              }`}
            >
              {locked ? t("schedule.finalized") : t("schedule.draft")}
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        {loading || !data ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-8" />
        ) : (
          <>
            <div className="rounded-2xl border border-card-border p-3">
              <div className="mb-2 flex justify-between text-[10px] tabular-nums text-muted">
                <span>7</span>
                <span>12</span>
                <span>17</span>
                <span>22</span>
              </div>
              {dayShifts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  {t("schedule.noShifts")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {dayShifts.map((shift) => {
                    const person = data.staff.find((s) => s.id === shift.userId);
                    const name = person?.username ?? "?";
                    const hours =
                      Math.round(((shift.endMin - shift.startMin) / 60) * 10) /
                      10;
                    return (
                      <li key={shift.id}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-full border border-primary/45 text-[10px] font-bold text-primary">
                            {initials(name)}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {name}
                          </span>
                          <span className="ml-auto text-xs tabular-nums text-muted">
                            {formatMinutesAsClock(shift.startMin)}–
                            {formatMinutesAsClock(shift.endMin)} · {hours}
                            {t("schedule.hoursShort")}
                          </span>
                        </div>
                        <div className="relative h-8 rounded-lg border border-card-border bg-transparent">
                          <div
                            className="absolute top-1 bottom-1 rounded-md border border-primary bg-selected"
                            style={{
                              left: `${leftPct(shift.startMin)}%`,
                              width: `${widthPct(shift.startMin, shift.endMin)}%`,
                            }}
                          />
                        </div>
                        {isOwner && !locked && data.week.mode === "manual" ? (
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              className={`${appButtonNeutral} flex-1 py-1.5 text-xs`}
                              disabled={saving}
                              onClick={() =>
                                void nudgeShift(shift, "start", -SCHEDULE_STEP_MIN)
                              }
                            >
                              {t("schedule.earlier")}
                            </button>
                            <button
                              type="button"
                              className={`${appButtonNeutral} flex-1 py-1.5 text-xs`}
                              disabled={saving}
                              onClick={() =>
                                void nudgeShift(shift, "end", SCHEDULE_STEP_MIN)
                              }
                            >
                              {t("schedule.later")}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {!locked ? (
              <div className="rounded-2xl border border-card-border p-3">
                <p className="text-sm font-semibold text-foreground">
                  {t("schedule.myDesire")}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t("schedule.myDesireHint")}
                </p>
                <div className="mt-3">
                  <RangeSlider
                    startMin={desireStart}
                    endMin={desireEnd}
                    disabled={saving}
                    onChange={(s, e) => {
                      setDesireStart(s);
                      setDesireEnd(e);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={`${appButtonPrimaryFull} mt-3`}
                  disabled={saving}
                  onClick={() => void saveDesire()}
                >
                  {t("schedule.saveDesire")}
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-muted">
                {t("schedule.viewOnly")}
              </p>
            )}

            {isOwner ? (
              <div className={`${appFooterButtonGrid} pt-1`}>
                {locked ? (
                  <button
                    type="button"
                    className={appButtonPrimary}
                    disabled={saving}
                    onClick={() => void ownerAction("reopen")}
                  >
                    {t("schedule.reopen")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={appButtonPrimary}
                      disabled={saving}
                      onClick={() => void ownerAction("finalize")}
                    >
                      {t("schedule.finalize")}
                    </button>
                    <button
                      type="button"
                      className={appButtonNeutral}
                      disabled={saving}
                      onClick={() => void ownerAction("runAuto")}
                    >
                      {t("schedule.runAuto")}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense
      fallback={<LoadingSpinnerBlock wrapperClassName="flex justify-center py-10" />}
    >
      <SchedulePageInner />
    </Suspense>
  );
}
