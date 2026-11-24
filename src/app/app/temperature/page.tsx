"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TemperatureCard } from "@/components/temperature-card";
import {
  TemperaturePointSheet,
  type TemperatureDraft,
} from "@/components/temperature-point-sheet";
import {
  ChevronBackIcon,
  ChevronRightIcon,
} from "@/components/app-nav-icons";
import { LoadingSpinnerPage } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import { replaceApp } from "@/lib/app-navigation";
import {
  appButtonPrimary,
  appListInset,
  appPageShell,
  appPageTopGlowClass,
  appSearchInput,
} from "@/lib/app-ui";
import {
  TEMPERATURE_FEATURE_ENABLED,
  temperatureCalendarYmd,
  type TemperaturePointDto,
} from "@/lib/temperature";

type ListResponse = {
  todayYmd: string;
  logDate: string;
  isOwner: boolean;
  dueIncomplete: number;
  points: TemperaturePointDto[];
  error?: string;
};

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toYmdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekDaysFromYmd(ymd: string): { ymd: string; date: Date }[] {
  const base = parseYmdLocal(ymd);
  const day = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { ymd: toYmdLocal(date), date };
  });
}

function shiftYmd(ymd: string, days: number): string {
  const date = parseYmdLocal(ymd);
  date.setDate(date.getDate() + days);
  return toYmdLocal(date);
}

function formatYmdDot(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function formatWeekRange(startYmd: string, endYmd: string): string {
  return `${formatYmdDot(startYmd)} – ${formatYmdDot(endYmd)}`;
}

function formatWeekdayShort(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "short" });
}

function formatLongDate(ymd: string, locale: string): string {
  return parseYmdLocal(ymd).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export default function TemperaturePage() {
  const { t, dateLocale } = useT();
  const { ready: sessionReady, homeUser } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const [points, setPoints] = useState<TemperaturePointDto[]>([]);
  const [todayYmd, setTodayYmd] = useState(() => temperatureCalendarYmd());
  const [selectedYmd, setSelectedYmd] = useState(() => temperatureCalendarYmd());
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sheet, setSheet] = useState<
    | { mode: "create" }
    | { mode: "edit" | "view"; point: TemperaturePointDto }
    | null
  >(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [uncheckPoint, setUncheckPoint] = useState<TemperaturePointDto | null>(
    null,
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 200);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!TEMPERATURE_FEATURE_ENABLED) {
      replaceApp("/app");
      return;
    }
    if (!sessionReady) return;
    if (homeUser) {
      replaceApp("/app");
    }
  }, [sessionReady, homeUser]);

  const load = useCallback(async () => {
    if (!TEMPERATURE_FEATURE_ENABLED) {
      setPoints([]);
      setLoading(false);
      return;
    }
    if (!storeId) {
      setPoints([]);
      setLoading(false);
      setError(t("errors.missingStoreId"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/temperature?storeId=${encodeURIComponent(storeId)}&date=${encodeURIComponent(selectedYmd)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as ListResponse;
      if (!res.ok) {
        setError(data.error || t("errors.networkError"));
        setPoints([]);
        return;
      }
      const serverToday = data.todayYmd || temperatureCalendarYmd();
      setTodayYmd(serverToday);
      setPoints(data.points ?? []);
      setIsOwner(Boolean(data.isOwner));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedYmd, t]);

  useEffect(() => {
    if (!sessionReady || !storeReady || homeUser) return;
    void load();
  }, [sessionReady, storeReady, homeUser, load]);

  const searchQuery = debouncedSearch.trim().toLowerCase();
  const canCompleteSelected = selectedYmd <= todayYmd;
  const weekDays = useMemo(() => weekDaysFromYmd(selectedYmd), [selectedYmd]);
  const weekContainsToday = useMemo(
    () => weekDays.some((day) => day.ymd === todayYmd),
    [weekDays, todayYmd],
  );

  function shiftWeek(deltaWeeks: number) {
    const next = shiftYmd(selectedYmd, deltaWeeks * 7);
    const nextWeek = weekDaysFromYmd(next);
    if (nextWeek.some((day) => day.ymd === todayYmd)) {
      setSelectedYmd(todayYmd);
      return;
    }
    setSelectedYmd(next);
  }

  const dayPoints = useMemo(() => {
    return points.filter((point) => {
      if (!searchQuery) return true;
      const title = point.title.toLowerCase();
      const note = (point.note ?? "").toLowerCase();
      return title.includes(searchQuery) || note.includes(searchQuery);
    });
  }, [points, searchQuery]);

  const sections = useMemo(() => {
    const todo = dayPoints.filter((point) => !point.completed);
    const done = dayPoints.filter((point) => point.completed);
    return { todo, done };
  }, [dayPoints]);

  const progress = useMemo(() => {
    const total = dayPoints.length;
    const doneCount = dayPoints.filter((point) => point.completed).length;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    return { total, doneCount, pct };
  }, [dayPoints]);

  function requestToggleChecked(point: TemperaturePointDto) {
    if (!canCompleteSelected) return;
    if (point.completed) {
      setUncheckPoint(point);
      return;
    }
    void applyToggleChecked(point, true);
  }

  async function applyToggleChecked(
    point: TemperaturePointDto,
    next: boolean,
    extras?: { comment?: string; celsius?: number | null },
  ) {
    setPoints((prev) =>
      prev.map((row) =>
        row.id === point.id
          ? {
              ...row,
              completed: next,
              completedAt: next ? new Date().toISOString() : null,
              completedBy: next
                ? { id: "me", username: "", displayName: null }
                : null,
              celsius: next
                ? (extras?.celsius ?? row.celsius)
                : null,
              rangeStatus: next ? row.rangeStatus : "unchecked",
            }
          : row,
      ),
    );
    try {
      const body: Record<string, unknown> = {
        completed: next,
        logDate: selectedYmd,
      };
      if (extras?.comment !== undefined) body.comment = extras.comment || null;
      if (extras?.celsius !== undefined) body.celsius = extras.celsius;
      const res = await fetch(`/api/temperature/${point.id}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        point?: TemperaturePointDto;
      };
      if (!res.ok || !data.point) {
        await load();
        return;
      }
      setPoints((prev) =>
        prev.map((row) => (row.id === data.point!.id ? data.point! : row)),
      );
      if (sheet && sheet.mode !== "create" && sheet.point.id === point.id) {
        setSheet({ mode: sheet.mode, point: data.point });
      }
    } catch {
      await load();
    }
  }

  async function confirmUncheck() {
    if (!uncheckPoint) return;
    const point = uncheckPoint;
    setUncheckPoint(null);
    if (sheet && sheet.mode !== "create" && sheet.point.id === point.id) {
      setSheet(null);
    }
    await applyToggleChecked(point, false);
  }

  async function saveDraft(draft: TemperatureDraft) {
    if (!storeId) throw new Error(t("errors.missingStoreId"));
    const minCelsius = parseOptionalNumber(draft.minCelsius);
    const maxCelsius = parseOptionalNumber(draft.maxCelsius);
    if (Number.isNaN(minCelsius) || Number.isNaN(maxCelsius)) {
      throw new Error(t("errors.invalidData"));
    }
    const body = {
      storeId,
      title: draft.title,
      note: draft.note || null,
      minCelsius,
      maxCelsius,
      comment: draft.comment || null,
    };

    if (sheet?.mode === "create") {
      const res = await fetch("/api/temperature", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        point?: TemperaturePointDto;
        error?: string;
      };
      if (!res.ok || !data.point) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setPoints((prev) => [data.point!, ...prev]);
      setSheet(null);
      return;
    }

    if (sheet?.mode === "edit") {
      const res = await fetch(
        `/api/temperature/${sheet.point.id}?date=${encodeURIComponent(selectedYmd)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        point?: TemperaturePointDto;
        error?: string;
      };
      if (!res.ok || !data.point) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setPoints((prev) =>
        prev.map((row) => (row.id === data.point!.id ? data.point! : row)),
      );
      setSheet(null);
    }
  }

  async function saveComment(draft: { comment: string }) {
    if (!sheet || sheet.mode === "create") return;
    const res = await fetch(
      `/api/temperature/${sheet.point.id}?date=${encodeURIComponent(selectedYmd)}`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: draft.comment || null }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      point?: TemperaturePointDto;
      error?: string;
    };
    if (!res.ok || !data.point) {
      throw new Error(data.error || t("errors.invalidData"));
    }
    setPoints((prev) =>
      prev.map((row) => (row.id === data.point!.id ? data.point! : row)),
    );
    setSheet(null);
  }

  async function toggleFromSheet(draft: {
    comment: string;
    celsius: string;
  }) {
    if (!sheet || sheet.mode === "create") return;
    const point = sheet.point;
    if (point.completed) {
      setUncheckPoint(point);
      return;
    }
    const celsius = parseOptionalNumber(draft.celsius);
    if (Number.isNaN(celsius)) {
      throw new Error(t("errors.invalidData"));
    }
    await applyToggleChecked(point, true, {
      comment: draft.comment,
      celsius,
    });
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setRemoveId(null);
    setPoints((prev) => prev.filter((row) => row.id !== id));
    setSheet(null);
    try {
      const res = await fetch(`/api/temperature/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) await load();
    } catch {
      await load();
    }
  }

  function renderPointList(rows: TemperaturePointDto[]) {
    if (rows.length === 0) return null;
    return (
      <ul className="space-y-2">
        {rows.map((point) => (
          <li key={point.id}>
            <TemperatureCard
              point={point}
              canToggle={canCompleteSelected}
              onOpen={() =>
                setSheet({
                  mode: isOwner ? "edit" : "view",
                  point,
                })
              }
              onToggleChecked={() => requestToggleChecked(point)}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (!TEMPERATURE_FEATURE_ENABLED) {
    return <LoadingSpinnerPage fullScreen />;
  }

  if (!sessionReady || !storeReady || loading) {
    return <LoadingSpinnerPage fullScreen />;
  }

  if (homeUser) {
    return <LoadingSpinnerPage fullScreen />;
  }

  const weekStart = weekDays[0]?.ymd;
  const weekEnd = weekDays[6]?.ymd;

  return (
    <div className={`${appPageShell} relative ${appListInset} pb-24 pt-1`}>
      <div className={appPageTopGlowClass} aria-hidden />
      <MobilePageHeader className="mb-2" />

      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("temperature.titlePage")}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted">
            {formatLongDate(selectedYmd, dateLocale)}
          </p>
        </div>
        {isOwner ? (
          <button
            type="button"
            className={appButtonPrimary}
            onClick={() => setSheet({ mode: "create" })}
          >
            + {t("temperature.add")}
          </button>
        ) : null}
      </div>

      <div className="mb-3 mt-3 rounded-2xl border border-card-border bg-zinc-950/80 px-3 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {t("temperature.progressLabel", {
              done: progress.doneCount,
              total: progress.total,
            })}
          </p>
          <p className="text-xs tabular-nums text-muted">{progress.pct}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-card-border text-foreground"
            aria-label={t("temperature.weekPrev")}
            onClick={() => shiftWeek(-1)}
          >
            <ChevronBackIcon className="size-4" />
          </button>
          <p className="min-w-0 flex-1 text-center text-sm font-semibold text-foreground">
            {weekContainsToday
              ? t("temperature.thisWeekRange", {
                  range: formatWeekRange(weekStart!, weekEnd!),
                })
              : t("temperature.weekRange", {
                  range: formatWeekRange(weekStart!, weekEnd!),
                })}
          </p>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-card-border text-foreground"
            aria-label={t("temperature.weekNext")}
            onClick={() => shiftWeek(1)}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const selected = day.ymd === selectedYmd;
            const isToday = day.ymd === todayYmd;
            return (
              <button
                key={day.ymd}
                type="button"
                onClick={() => setSelectedYmd(day.ymd)}
                className={`rounded-xl border px-0.5 py-1.5 text-center ${
                  selected
                    ? "border-primary bg-selected text-primary"
                    : "border-card-border text-foreground"
                }`}
              >
                <span className="block text-[10px] font-semibold uppercase text-muted">
                  {formatWeekdayShort(day.date, dateLocale)}
                </span>
                <span
                  className={`mt-0.5 block text-sm font-semibold tabular-nums ${
                    isToday && !selected ? "text-primary" : ""
                  }`}
                >
                  {day.date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!canCompleteSelected ? (
        <p className="mb-2 text-sm text-muted">
          {t("temperature.futureDayHint")}
        </p>
      ) : selectedYmd !== todayYmd ? (
        <p className="mb-2 text-sm text-muted">
          {t("temperature.otherDayHint")}
        </p>
      ) : null}

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder={t("temperature.searchPlaceholder")}
        aria-label={t("temperature.searchPlaceholder")}
        inputClassName={appSearchInput}
        className="mb-3"
      />

      {error ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {dayPoints.length === 0 ? (
        <p className="text-sm text-muted">
          {searchQuery
            ? t("temperature.noResults")
            : isOwner
              ? t("temperature.empty")
              : t("temperature.emptyStaff")}
        </p>
      ) : (
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {t("temperature.sectionTodo")}
            </h2>
            {sections.todo.length === 0 ? (
              <p className="text-sm text-muted">{t("temperature.todoEmpty")}</p>
            ) : (
              renderPointList(sections.todo)
            )}
          </section>
          {sections.done.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                {t("temperature.sectionDone")}
              </h2>
              {renderPointList(sections.done)}
            </section>
          ) : null}
        </div>
      )}

      {sheet ? (
        <TemperaturePointSheet
          mode={sheet.mode}
          isOwner={isOwner}
          initial={sheet.mode === "create" ? null : sheet.point}
          canComplete={canCompleteSelected}
          onClose={() => setSheet(null)}
          onSave={
            sheet.mode === "create" || sheet.mode === "edit"
              ? saveDraft
              : undefined
          }
          onSaveComment={sheet.mode === "view" ? saveComment : undefined}
          onToggleDone={
            sheet.mode === "create" ? undefined : toggleFromSheet
          }
          onRemove={
            sheet.mode === "edit"
              ? () => setRemoveId(sheet.point.id)
              : undefined
          }
        />
      ) : null}

      {removeId ? (
        <RemoveConfirmDialog
          title={t("temperature.removeTitle")}
          message={t("temperature.removeMessage")}
          itemLabel={
            points.find((p) => p.id === removeId)?.title ??
            t("temperature.title")
          }
          cancelLabel={t("common.cancel")}
          removeLabel={t("temperature.remove")}
          onCancel={() => setRemoveId(null)}
          onConfirm={() => void confirmRemove()}
        />
      ) : null}

      {uncheckPoint ? (
        <RemoveConfirmDialog
          title={t("temperature.uncheckTitle")}
          message={t("temperature.uncheckMessage")}
          itemLabel={uncheckPoint.title}
          cancelLabel={t("common.cancel")}
          removeLabel={t("temperature.uncheckConfirm")}
          onCancel={() => setUncheckPoint(null)}
          onConfirm={() => void confirmUncheck()}
        />
      ) : null}
    </div>
  );
}
