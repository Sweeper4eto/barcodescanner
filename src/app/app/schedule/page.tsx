"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionFlash } from "@/components/action-flash";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ChevronRightIcon, SaveDiskIcon } from "@/components/app-nav-icons";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import {
  appButtonPrimaryFull,
  appChromeInset,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import { useBrowserBackStack } from "@/lib/browser-back";
import { addDaysYmd, mondayOfWeek, parseYmd } from "@/lib/schedule";
import {
  downloadScheduleWeekPng,
  openScheduleWeekPrint,
  type ScheduleWeekPrintLabels,
} from "@/lib/schedule-week-print";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { DayCoverageBar, initials, MemberHoursLabel, MemberShiftBar } from "@/components/schedule-shift-bars";
import {
  SchedulePicturePreview,
  ScheduleSaveFormatDialog,
} from "@/components/schedule-export-sheets";

type Staff = {
  id: string;
  username: string;
  displayName?: string | null;
  clientRole: string | null;
};
type Shift = {
  id: string;
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};
type DayState = {
  dayIndex: number;
  mode: "auto" | "manual";
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | null;
  excludedUserIds: string[];
};
type WeekPayload = {
  week: {
    id: string;
    storeId: string;
    weekStart: string;
  };
  days: DayState[];
  staff: Staff[];
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

const DAY_FULL_LABELS = [
  "schedule.dayMonFull",
  "schedule.dayTueFull",
  "schedule.dayWedFull",
  "schedule.dayThuFull",
  "schedule.dayFriFull",
  "schedule.daySatFull",
  "schedule.daySunFull",
] as const;



function SchedulePageInner() {
  const { t } = useT();
  const { storeId, ready: storeReady } = useAppStoreId();
  const { user: sessionUser } = useAppSession();
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [dayIndex, setDayIndex] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1;
  });
  const [data, setData] = useState<WeekPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFormatOpen, setSaveFormatOpen] = useState(false);
  const [savingExport, setSavingExport] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [picturePreview, setPicturePreview] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [liveHoursByUser, setLiveHoursByUser] = useState<
    Record<string, { startMin: number; endMin: number }>
  >({});
  const { offsetTop, keyboardInset } = useViewportInsets();
  const clearFlash = useCallback(() => setFlashMessage(null), []);
  const closePicturePreview = useCallback(() => {
    setPicturePreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);
  useBrowserBackStack([
    {
      id: "schedule-picture",
      open: picturePreview !== null,
      close: closePicturePreview,
    },
  ]);
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;
  const fetchGenerationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /** Always land on the current week when opening the scheduler. */
  useEffect(() => {
    setWeekStart(mondayOfWeek());
    const d = new Date().getDay();
    setDayIndex(d === 0 ? 6 : d - 1);
  }, []);

  useEffect(() => {
    setLiveHoursByUser({});
  }, [weekStart, dayIndex]);

  const load = useCallback(async () => {
    if (!storeId) return;
    const requestedStoreId = storeId;
    const generation = ++fetchGenerationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/schedule?storeId=${encodeURIComponent(requestedStoreId)}&weekStart=${encodeURIComponent(weekStart)}`,
        { cache: "no-store", signal: controller.signal },
      );
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (generation !== fetchGenerationRef.current) return;
      if (storeIdRef.current !== requestedStoreId) return;
      if (!res.ok) {
        setError(json.error ?? t("schedule.loadFailed"));
        setData(null);
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (generation !== fetchGenerationRef.current) return;
      if (storeIdRef.current !== requestedStoreId) return;
      setError(t("schedule.loadFailed"));
      setData(null);
    } finally {
      if (
        generation === fetchGenerationRef.current &&
        storeIdRef.current === requestedStoreId
      ) {
        setLoading(false);
      }
    }
  }, [storeId, weekStart, t]);

  useEffect(() => {
    if (!storeReady || !storeId) return;
    void load();
  }, [storeReady, storeId, load]);

  const dayShifts = useMemo(
    () =>
      (data?.shifts ?? [])
        .filter((s) => s.dayIndex === dayIndex)
        .sort((a, b) => a.startMin - b.startMin),
    [data, dayIndex],
  );

  const dayState = useMemo(() => {
    return (
      data?.days.find((d) => d.dayIndex === dayIndex) ?? {
        dayIndex,
        mode: "auto" as const,
        status: "DRAFT" as const,
        finalizedAt: null,
        excludedUserIds: [] as string[],
      }
    );
  }, [data, dayIndex]);

  const excludedToday = useMemo(
    () => new Set(dayState.excludedUserIds ?? []),
    [dayState.excludedUserIds],
  );

  const memberRows = useMemo(() => {
    if (!data) return [];
    const people = data.me.isOwner
      ? data.staff
      : data.staff.filter((p) => !excludedToday.has(p.id));
    return people.map((person) => {
      const shift = dayShifts.find((s) => s.userId === person.id) ?? null;
      return { person, shift };
    });
  }, [data, dayShifts, excludedToday]);

  const isFinalized = dayState.status === "FINALIZED";
  const isOwner = Boolean(data?.me.isOwner);
  /** Finalized day is locked for everyone until the owner taps Edit. */
  const readOnly = isFinalized;
  const ownerCanEditShifts = Boolean(isOwner && !readOnly);

  /**
   * Coverage follows who’s included today and the same ranges as the green
   * bars (saved / live / editable 10–16 placeholder).
   */
  const dayCoverageRanges = useMemo(() => {
    const ranges: { startMin: number; endMin: number }[] = [];
    for (const { person, shift } of memberRows) {
      if (excludedToday.has(person.id)) continue;
      const live = liveHoursByUser[person.id];
      const assigned = shift
        ? { startMin: shift.startMin, endMin: shift.endMin }
        : null;
      const effective =
        live ??
        assigned ??
        (ownerCanEditShifts
          ? { startMin: 10 * 60, endMin: 16 * 60 }
          : null);
      if (effective && effective.endMin > effective.startMin) {
        ranges.push(effective);
      }
    }
    return ranges;
  }, [memberRows, excludedToday, liveHoursByUser, ownerCanEditShifts]);

  const missingShiftCount = useMemo(() => {
    if (!ownerCanEditShifts) return 0;
    return memberRows.filter(
      ({ person, shift }) =>
        !excludedToday.has(person.id) &&
        !shift &&
        !liveHoursByUser[person.id],
    ).length;
  }, [memberRows, excludedToday, liveHoursByUser, ownerCanEditShifts]);

  async function ownerAction(
    action: "setMode" | "runAuto" | "finalize" | "reopen" | "setParticipant",
    mode?: "auto" | "manual",
    extra?: { userId: string; scheduleParticipant: boolean },
  ) {
    if (!storeId || !data) return;
    const requestedStoreId = storeId;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: requestedStoreId,
          weekStart,
          dayIndex,
          action,
          mode,
          ...extra,
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (storeIdRef.current !== requestedStoreId) return;
      if (!res.ok) {
        setError(json.error ?? t("schedule.saveFailed"));
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch {
      if (storeIdRef.current !== requestedStoreId) return;
      setError(t("schedule.saveFailed"));
    } finally {
      if (storeIdRef.current === requestedStoreId) setSaving(false);
    }
  }

  async function saveMemberShift(
    userId: string,
    startMin: number,
    endMin: number,
  ) {
    if (!storeId || !data || !ownerCanEditShifts) return;
    const requestedStoreId = storeId;
    const others = data.shifts
      .filter((s) => s.dayIndex === dayIndex && s.userId !== userId)
      .map((s) => ({
        userId: s.userId,
        dayIndex: s.dayIndex,
        startMin: s.startMin,
        endMin: s.endMin,
      }));
    const next = [
      ...others,
      { userId, dayIndex, startMin, endMin },
    ];
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: requestedStoreId,
          weekStart,
          dayIndex,
          action: "setShifts",
          shifts: next,
        }),
      });
      const json = (await res.json()) as WeekPayload & { error?: string };
      if (storeIdRef.current !== requestedStoreId) return;
      if (!res.ok) {
        setError(json.error ?? t("schedule.invalidBounds"));
        return;
      }
      setData(json);
      setLiveHoursByUser({});
    } catch {
      if (storeIdRef.current !== requestedStoreId) return;
      setError(t("schedule.saveFailed"));
    } finally {
      if (storeIdRef.current === requestedStoreId) setSaving(false);
    }
  }

  const weekLabel = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = parseYmd(weekStart);
    const end = parseYmd(addDaysYmd(weekStart, 6));
    return `${pad(start.getDate())}.${pad(start.getMonth() + 1)} – ${pad(end.getDate())}.${pad(end.getMonth() + 1)}`;
  }, [weekStart]);

  const selectedDayLabel = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = parseYmd(addDaysYmd(weekStart, dayIndex));
    const dateLabel = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    return {
      name: t(DAY_FULL_LABELS[dayIndex]!),
      dateLabel,
    };
  }, [weekStart, dayIndex, t]);

  const storeName = useMemo(
    () =>
      sessionUser?.stores.find((store) => store.id === storeId)?.name ?? "",
    [sessionUser?.stores, storeId],
  );

  function weekPrintLabels(): ScheduleWeekPrintLabels {
    return {
      title: t("schedule.saveWeekPrintTitle"),
      storeLabel: t("schedule.saveWeekStore"),
      weekLabel: t("schedule.saveWeekRange"),
      personColumn: t("schedule.saveWeekPerson"),
      fromColumn: t("schedule.saveWeekFrom"),
      toColumn: t("schedule.saveWeekTo"),
      durationColumn: t("schedule.saveWeekDuration"),
      noShifts: t("schedule.saveWeekNoShifts"),
      noSchedule: t("schedule.saveWeekNoSchedule"),
      dayNames: DAY_FULL_LABELS.map((key) => t(key)),
      hoursUnit: t("schedule.hoursShort"),
      minutesUnit: t("schedule.minutesShort"),
      printHint: t("schedule.saveWeekPrintHint"),
    };
  }

  function exportWeekAsPdf() {
    if (!data) return;
    setSaveFormatOpen(false);
    setFlashMessage(null);
    const opened = openScheduleWeekPrint({
      weekStart,
      storeName,
      staff: data.staff,
      shifts: data.shifts,
      days: data.days,
      labels: weekPrintLabels(),
    });
    if (!opened) {
      setError(t("schedule.saveWeekPopupBlocked"));
      return;
    }
    setError(null);
    setFlashMessage(t("schedule.saveWeekSaved"));
  }

  async function exportWeekAsPicture() {
    // Use in-memory week data (same as PDF). Awaiting a refetch here breaks the
    // mobile user-gesture chain, so the download fails silently.
    if (!storeId || !data || savingExport) return;
    setSavingExport(true);
    setError(null);
    setFlashMessage(null);
    try {
      const result = downloadScheduleWeekPng({
        weekStart,
        storeName,
        staff: data.staff,
        shifts: data.shifts,
        days: data.days,
        labels: weekPrintLabels(),
      });
      setSaveFormatOpen(false);
      if (result.status === "failed") {
        setError(t("schedule.saveWeekPictureFailed"));
        return;
      }
      if (result.status === "preview") {
        setPicturePreview({ url: result.url, filename: result.filename });
        return;
      }
      setFlashMessage(t("schedule.saveWeekPictureSaved"));
    } catch {
      setSaveFormatOpen(false);
      setError(t("schedule.saveWeekPictureFailed"));
    } finally {
      setSavingExport(false);
    }
  }

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
    <div className={`${appPageShell} flex min-h-0 flex-col pb-4`}>
      <div className={appChromeInset}>
        <MobilePageHeader title={t("schedule.title")} />
      </div>

      <div className={`${appListInset} mt-3 space-y-3`}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {selectedDayLabel.name}
            </p>
            <p className="text-xs tabular-nums text-muted">
              {selectedDayLabel.dateLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDaysYmd(weekStart, -7))}
            >
              <ChevronRightIcon className="size-4 rotate-180" />
            </button>
            <p className="px-1 text-sm font-semibold tabular-nums text-foreground">
              {weekLabel}
            </p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label="Next week"
              onClick={() => setWeekStart(addDaysYmd(weekStart, 7))}
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full border border-primary/45 text-primary disabled:opacity-50"
              aria-label={t("schedule.saveWeek")}
              title={t("schedule.saveWeek")}
              disabled={!data || loading || savingExport}
              onClick={() => setSaveFormatOpen(true)}
            >
              <SaveDiskIcon className="size-4" />
            </button>
          </div>
        </div>

        <ScheduleSaveFormatDialog
          open={saveFormatOpen}
          saving={savingExport}
          top={offsetTop}
          bottom={keyboardInset}
          onClose={() => setSaveFormatOpen(false)}
          onPdf={() => exportWeekAsPdf()}
          onPicture={() => void exportWeekAsPicture()}
        />
        <SchedulePicturePreview
          preview={picturePreview}
          onClose={closePicturePreview}
        />

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((key, idx) => {
            const active = idx === dayIndex;
            const day = data?.days.find((d) => d.dayIndex === idx);
            const dayDone = day?.status === "FINALIZED";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDayIndex(idx)}
                className={`flex min-w-0 flex-col items-center justify-start gap-0.5 rounded-lg border px-0.5 py-1 text-[0.65rem] font-semibold leading-tight ${
                  active
                    ? "border-primary bg-selected text-primary"
                    : "border-card-border text-muted"
                }`}
              >
                <span className="min-w-0 truncate">{t(key)}</span>
                <span
                  className="inline-flex h-2.5 w-full shrink-0 items-center justify-center text-[9px] leading-none text-primary"
                  aria-hidden={!dayDone}
                >
                  {dayDone ? "✓" : null}
                </span>
              </button>
            );
          })}
        </div>

        {isOwner ? (
          <div
            role="group"
            aria-label={t("schedule.title")}
            className="grid grid-cols-2 gap-0.5 rounded-xl border border-card-border p-0.5"
          >
            <button
              type="button"
              disabled={saving || !isFinalized}
              className={`rounded-lg px-2 py-2 text-center text-[0.7rem] font-semibold ${
                !isFinalized
                  ? "bg-selected text-primary"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => {
                if (isFinalized) void ownerAction("reopen");
              }}
            >
              {isFinalized
                ? t("schedule.edit")
                : t("schedule.modeManual")}
            </button>
            <button
              type="button"
              disabled={saving || isFinalized}
              className={`rounded-lg px-2 py-2 text-center text-[0.7rem] font-semibold ${
                isFinalized
                  ? "bg-selected text-primary"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => void ownerAction("finalize")}
            >
              {isFinalized
                ? t("schedule.finalized")
                : t("schedule.finalize")}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        <ActionFlash
          message={flashMessage}
          durationMs={2000}
          onClear={clearFlash}
        />

        {loading || !data ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-8" />
        ) : (
          <>
            <div className="rounded-2xl border border-card-border p-3">
              <DayCoverageBar
                ranges={dayCoverageRanges}
                hoursUnit={t("schedule.hoursShort")}
                minutesUnit={t("schedule.minutesShort")}
                labelFull={t("schedule.coverageFull")}
                labelPartial={t("schedule.coveragePartial")}
                labelEmpty={t("schedule.coverageEmpty")}
              />
              {missingShiftCount > 0 ? (
                <p className="mb-2 text-[0.65rem] text-muted">
                  {t("schedule.coverageHintAuto")}
                </p>
              ) : null}
              {isOwner ? (
                <p className="mb-2 text-[0.65rem] text-muted">
                  <span className="mr-2 inline-block size-2 rounded-sm bg-primary/70 align-middle" />
                  {t("schedule.legendAssigned")}
                </p>
              ) : null}
              {memberRows.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  {t("schedule.noShifts")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {memberRows.map(({ person, shift }) => {
                    const name =
                      person.displayName?.trim() || person.username;
                    const inSchedule = !excludedToday.has(person.id);
                    const assigned = shift
                      ? { startMin: shift.startMin, endMin: shift.endMin }
                      : null;
                    return (
                      <li
                        key={person.id}
                        className={inSchedule ? undefined : "opacity-45"}
                      >
                        <div className="mb-1 grid grid-cols-[1.25rem_1.75rem_minmax(0,1fr)_auto] items-center gap-x-2">
                          {isOwner ? (
                            <label className="flex size-5 items-center justify-center">
                              <input
                                type="checkbox"
                                className="size-3.5 accent-[var(--primary)]"
                                checked={inSchedule}
                                disabled={saving || readOnly}
                                aria-label={t("schedule.includePerson", {
                                  name,
                                })}
                                onChange={(event) =>
                                  void ownerAction("setParticipant", undefined, {
                                    userId: person.id,
                                    scheduleParticipant: event.target.checked,
                                  })
                                }
                              />
                            </label>
                          ) : (
                            <span className="size-5" aria-hidden />
                          )}
                          <span className="flex size-7 items-center justify-center rounded-full border border-primary/45 text-[10px] font-bold text-primary">
                            {initials(name)}
                          </span>
                          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                            {name}
                          </span>
                          <MemberHoursLabel
                            personId={person.id}
                            assigned={assigned}
                            liveByUser={liveHoursByUser}
                            hoursUnit={t("schedule.hoursShort")}
                            minutesUnit={t("schedule.minutesShort")}
                          />
                        </div>
                        {inSchedule ? (
                          <MemberShiftBar
                            assigned={assigned}
                            editable={ownerCanEditShifts}
                            disabled={saving}
                            onLiveChange={(startMin, endMin) =>
                              setLiveHoursByUser((prev) => ({
                                ...prev,
                                [person.id]: { startMin, endMin },
                              }))
                            }
                            onCommit={(startMin, endMin) =>
                              void saveMemberShift(person.id, startMin, endMin)
                            }
                          />
                        ) : (
                          <p className="text-[0.65rem] text-muted">
                            {t("schedule.excludedFromSchedule")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {readOnly ? (
              <p className="text-center text-xs text-muted">
                {t("schedule.viewOnly")}
              </p>
            ) : null}

            {isOwner ? (
              <div className="pt-1">
                <button
                  type="button"
                  className={appButtonPrimaryFull}
                  disabled={saving || readOnly}
                  onClick={() => void ownerAction("runAuto")}
                >
                  {t("schedule.runAuto")}
                </button>
                <p className="mt-1.5 text-center text-[0.65rem] text-muted">
                  {t("schedule.runAutoHint")}
                </p>
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
