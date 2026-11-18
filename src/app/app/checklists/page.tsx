"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChecklistCard } from "@/components/checklist-card";
import {
  ChecklistTaskSheet,
  resolveChecklistCommentImagePath,
  type ChecklistDraft,
} from "@/components/checklist-task-sheet";
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
  CHECKLISTS_FEATURE_ENABLED,
  checklistCalendarYmd,
  isChecklistTaskDueOn,
  type ChecklistTaskDto,
} from "@/lib/checklist";

type ListResponse = {
  todayYmd: string;
  isOwner: boolean;
  dueTodayIncomplete: number;
  tasks: ChecklistTaskDto[];
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

/** Monday-start week containing `ymd`. */
function weekDaysFromYmd(ymd: string): { ymd: string; date: Date }[] {
  const base = parseYmdLocal(ymd);
  const day = (base.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(base);
  monday.setDate(base.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { ymd: toYmdLocal(date), date };
  });
}

/** Shift a YMD by whole days (keeps noon local). */
function shiftYmd(ymd: string, days: number): string {
  const date = parseYmdLocal(ymd);
  date.setDate(date.getDate() + days);
  return toYmdLocal(date);
}

/** Compact week-range dates: 28.12.2026 */
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

function recurrenceLabel(
  task: Pick<
    ChecklistTaskDto,
    "recurrence" | "dueDate" | "weekday" | "monthDay"
  >,
  t: ReturnType<typeof useT>["t"],
): string {
  if (task.recurrence === "daily") return t("checklists.recurrenceDaily");
  if (task.recurrence === "once") {
    return task.dueDate
      ? t("checklists.recurrenceOnceOn", { date: task.dueDate })
      : t("checklists.recurrenceOnce");
  }
  if (task.recurrence === "weekly") return t("checklists.recurrenceWeekly");
  if (task.recurrence === "monthly") return t("checklists.recurrenceMonthly");
  return task.recurrence;
}

function recurrenceBadge(
  task: Pick<ChecklistTaskDto, "recurrence" | "dueDate">,
  t: ReturnType<typeof useT>["t"],
): string {
  if (task.recurrence === "daily") return t("checklists.badgeDaily");
  if (task.recurrence === "weekly") return t("checklists.badgeWeekly");
  if (task.recurrence === "monthly") return t("checklists.badgeMonthly");
  if (task.recurrence === "once" && task.dueDate) {
    const timeMatch = task.dueDate.match(/T(\d{2}:\d{2})/);
    if (timeMatch) return timeMatch[1];
    const parts = task.dueDate.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
    return task.dueDate;
  }
  return t("checklists.recurrenceOnce");
}

export default function ChecklistsPage() {
  const { t, dateLocale } = useT();
  const { ready: sessionReady, homeUser } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const [tasks, setTasks] = useState<ChecklistTaskDto[]>([]);
  const [todayYmd, setTodayYmd] = useState(() => checklistCalendarYmd());
  const [selectedYmd, setSelectedYmd] = useState(() => checklistCalendarYmd());
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [recurrenceFilter, setRecurrenceFilter] = useState<
    "all" | "daily" | "weekly" | "monthly"
  >("all");
  const [sheet, setSheet] = useState<
    | { mode: "create" }
    | { mode: "edit" | "view"; task: ChecklistTaskDto }
    | null
  >(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [uncheckTask, setUncheckTask] = useState<ChecklistTaskDto | null>(
    null,
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 200);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    if (!CHECKLISTS_FEATURE_ENABLED) {
      replaceApp("/app");
      return;
    }
    if (!sessionReady) return;
    if (homeUser) {
      replaceApp("/app");
    }
  }, [sessionReady, homeUser]);

  const load = useCallback(async () => {
    if (!CHECKLISTS_FEATURE_ENABLED) {
      setTasks([]);
      setLoading(false);
      return;
    }
    if (!storeId) {
      setTasks([]);
      setLoading(false);
      setError(t("errors.missingStoreId"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/checklists?storeId=${encodeURIComponent(storeId)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as ListResponse;
      if (!res.ok) {
        setError(data.error || t("errors.networkError"));
        setTasks([]);
        return;
      }
      const serverToday = data.todayYmd || checklistCalendarYmd();
      setTodayYmd(serverToday);
      setSelectedYmd((prev) => prev || serverToday);
      setTasks(data.tasks ?? []);
      setIsOwner(Boolean(data.isOwner));
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [storeId, t]);

  useEffect(() => {
    if (!sessionReady || !storeReady || homeUser) return;
    void load();
  }, [sessionReady, storeReady, homeUser, load]);

  const searchQuery = debouncedSearch.trim().toLowerCase();
  const viewingToday = selectedYmd === todayYmd;
  const weekDays = useMemo(() => weekDaysFromYmd(selectedYmd), [selectedYmd]);
  const weekContainsToday = useMemo(
    () => weekDays.some((day) => day.ymd === todayYmd),
    [weekDays, todayYmd],
  );

  function shiftWeek(deltaWeeks: number) {
    const next = shiftYmd(selectedYmd, deltaWeeks * 7);
    // If the new week includes today, land on today; else keep weekday.
    const nextWeek = weekDaysFromYmd(next);
    if (nextWeek.some((day) => day.ymd === todayYmd)) {
      setSelectedYmd(todayYmd);
      return;
    }
    setSelectedYmd(next);
  }

  /** Keep filter chips on-screen when the list height collapses after a filter change. */
  function setRecurrenceFilterStable(
    next: "all" | "daily" | "weekly" | "monthly",
    anchor: HTMLElement | null,
  ) {
    if (next === recurrenceFilter) return;
    const beforeTop = anchor?.getBoundingClientRect().top;
    setRecurrenceFilter(next);
    if (beforeTop == null) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!anchor.isConnected) return;
        const delta = anchor.getBoundingClientRect().top - beforeTop;
        if (Math.abs(delta) >= 1) {
          window.scrollBy(0, delta);
        }
      });
    });
  }

  const dayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!isChecklistTaskDueOn(task, selectedYmd)) return false;
      if (recurrenceFilter !== "all" && task.recurrence !== recurrenceFilter) {
        return false;
      }
      if (!searchQuery) return true;
      const title = task.title.toLowerCase();
      const note = (task.note ?? "").toLowerCase();
      return title.includes(searchQuery) || note.includes(searchQuery);
    });
  }, [tasks, selectedYmd, searchQuery, recurrenceFilter]);

  const sections = useMemo(() => {
    // Completion flags from API are for "today" only.
    const todo = dayTasks.filter((task) =>
      viewingToday ? !task.completedToday : true,
    );
    const done = viewingToday
      ? dayTasks.filter((task) => task.completedToday)
      : [];
    return { todo, done };
  }, [dayTasks, viewingToday]);

  const progress = useMemo(() => {
    const total = dayTasks.length;
    const doneCount = viewingToday
      ? dayTasks.filter((task) => task.completedToday).length
      : 0;
    const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
    return { total, doneCount, pct };
  }, [dayTasks, viewingToday]);

  function requestToggleChecked(
    task: ChecklistTaskDto,
    extras?: {
      comment?: string;
      commentImagePath?: string | null;
      commentImageDataUrl?: string | null;
    },
  ) {
    if (!viewingToday) return;
    if (task.completedToday) {
      setUncheckTask(task);
      return;
    }
    void applyToggleChecked(task, true, extras);
  }

  async function applyToggleChecked(
    task: ChecklistTaskDto,
    next: boolean,
    extras?: {
      comment?: string;
      commentImagePath?: string | null;
      commentImageDataUrl?: string | null;
    },
  ) {
    setTasks((prev) =>
      prev.map((row) =>
        row.id === task.id
          ? {
              ...row,
              completedToday: next,
              completedTodayAt: next ? new Date().toISOString() : null,
              completedTodayBy: next
                ? { id: "me", username: "", displayName: null }
                : null,
            }
          : row,
      ),
    );
    try {
      const body: Record<string, unknown> = { completed: next };
      if (extras) {
        const imagePath = await resolveChecklistCommentImagePath({
          commentImagePath: extras.commentImagePath ?? task.commentImagePath,
          commentImageDataUrl: extras.commentImageDataUrl ?? null,
        });
        if (extras.comment !== undefined) body.comment = extras.comment || null;
        body.commentImagePath = imagePath;
      }
      const res = await fetch(`/api/checklists/${task.id}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        task?: ChecklistTaskDto;
      };
      if (!res.ok || !data.task) {
        await load();
        return;
      }
      setTasks((prev) =>
        prev.map((row) => (row.id === data.task!.id ? data.task! : row)),
      );
    } catch {
      await load();
    }
  }

  async function confirmUncheck() {
    if (!uncheckTask) return;
    const task = uncheckTask;
    setUncheckTask(null);
    if (sheet && sheet.mode !== "create" && sheet.task.id === task.id) {
      setSheet(null);
    }
    await applyToggleChecked(task, false);
  }

  async function saveDraft(draft: ChecklistDraft) {
    if (!storeId) throw new Error(t("errors.missingStoreId"));
    const commentImagePath = await resolveChecklistCommentImagePath(draft);
    const body = {
      storeId,
      title: draft.title,
      note: draft.note || null,
      comment: draft.comment || null,
      commentImagePath,
      recurrence: draft.recurrence,
      dueDate: draft.recurrence === "once" ? draft.dueDate : null,
      weekday: null,
      monthDay: null,
      saveAsFavourite: false,
    };

    if (sheet?.mode === "create") {
      const res = await fetch("/api/checklists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        task?: ChecklistTaskDto;
        error?: string;
      };
      if (!res.ok || !data.task) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setTasks((prev) => [data.task!, ...prev]);
      setSheet(null);
      return;
    }

    if (sheet?.mode === "edit") {
      const res = await fetch(`/api/checklists/${sheet.task.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        task?: ChecklistTaskDto;
        error?: string;
      };
      if (!res.ok || !data.task) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setTasks((prev) =>
        prev.map((row) => (row.id === data.task!.id ? data.task! : row)),
      );
      setSheet(null);
    }
  }

  async function saveComment(draft: {
    comment: string;
    commentImagePath: string | null;
    commentImageDataUrl: string | null;
  }) {
    if (!sheet || sheet.mode === "create") return;
    const taskId = sheet.task.id;
    const commentImagePath = await resolveChecklistCommentImagePath(draft);
    const res = await fetch(`/api/checklists/${taskId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comment: draft.comment || null,
        commentImagePath,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      task?: ChecklistTaskDto;
      error?: string;
    };
    if (!res.ok || !data.task) {
      throw new Error(data.error || t("errors.invalidData"));
    }
    setTasks((prev) =>
      prev.map((row) => (row.id === data.task!.id ? data.task! : row)),
    );
    setSheet(null);
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setRemoveId(null);
    setTasks((prev) => prev.filter((row) => row.id !== id));
    setSheet(null);
    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) await load();
    } catch {
      await load();
    }
  }

  function renderTaskList(rows: ChecklistTaskDto[]) {
    if (rows.length === 0) return null;
    return (
      <ul className="space-y-2">
        {rows.map((task) => (
          <li key={task.id}>
            <ChecklistCard
              task={task}
              recurrenceLabel={recurrenceLabel(task, t)}
              recurrenceBadge={recurrenceBadge(task, t)}
              canToggle={viewingToday}
              onOpen={() =>
                setSheet({
                  mode: isOwner ? "edit" : "view",
                  task,
                })
              }
              onToggleChecked={() => requestToggleChecked(task)}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (!CHECKLISTS_FEATURE_ENABLED) {
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
            {t("checklists.titlePage")}
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
            + {t("checklists.add")}
          </button>
        ) : null}
      </div>

      <div className="mb-3 mt-3 rounded-2xl border border-card-border bg-zinc-950/80 px-3 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            {t("checklists.progressLabel", {
              done: String(progress.doneCount),
              total: String(progress.total),
            })}
          </p>
          <p className="text-sm font-semibold tabular-nums text-primary">
            {progress.pct}%
          </p>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-zinc-800"
          role="progressbar"
          aria-valuenow={progress.pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 flex items-center gap-1">
          <button
            type="button"
            aria-label={t("checklists.weekPrev")}
            title={t("checklists.weekPrev")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-card-border text-foreground"
            onClick={() => shiftWeek(-1)}
          >
            <ChevronBackIcon className="size-4" />
          </button>
          <p className="min-w-0 flex-1 text-center text-xs font-semibold text-muted">
            {t(
              weekContainsToday
                ? "checklists.thisWeekRange"
                : "checklists.weekRange",
              {
                range:
                  weekStart && weekEnd
                    ? formatWeekRange(weekStart, weekEnd)
                    : "",
              },
            )}
          </p>
          <button
            type="button"
            aria-label={t("checklists.weekNext")}
            title={t("checklists.weekNext")}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-card-border text-foreground"
            onClick={() => shiftWeek(1)}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(({ ymd, date }) => {
            const active = ymd === selectedYmd;
            const isToday = ymd === todayYmd;
            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelectedYmd(ymd)}
                className={`flex flex-col items-center rounded-xl border px-0.5 py-1.5 ${
                  active
                    ? "border-primary bg-selected text-primary"
                    : "border-card-border bg-transparent text-foreground"
                }`}
              >
                <span className="text-[10px] font-medium capitalize leading-none text-muted">
                  {formatWeekdayShort(date, dateLocale)}
                </span>
                <span className="mt-1 text-sm font-semibold tabular-nums leading-none">
                  {date.getDate()}
                </span>
                {isToday && !active ? (
                  <span className="mt-1 size-1 rounded-full bg-primary" aria-hidden />
                ) : (
                  <span className="mt-1 size-1" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t("checklists.searchPlaceholder")}
          aria-label={t("checklists.searchPlaceholder")}
          inputClassName={appSearchInput}
        />
      </div>

      <div
        className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-card-border p-1"
        role="tablist"
        aria-label={t("checklists.filterLabel")}
      >
        {(
          [
            { id: "daily", label: t("checklists.filterDaily") },
            { id: "weekly", label: t("checklists.filterWeekly") },
            { id: "monthly", label: t("checklists.filterMonthly") },
            { id: "all", label: t("checklists.filterAll") },
          ] as const
        ).map((opt) => {
          const active = recurrenceFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={(event) =>
                setRecurrenceFilterStable(opt.id, event.currentTarget)
              }
              className={`rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight ${
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

      {error ? (
        <p className="mb-3 rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      {!viewingToday ? (
        <p className="mb-3 text-xs text-muted">
          {t("checklists.otherDayHint")}
        </p>
      ) : null}

      {tasks.length === 0 && !error ? (
        <p className="text-sm text-muted">{t("checklists.empty")}</p>
      ) : dayTasks.length === 0 ? (
        <p className="text-sm text-muted">{t("checklists.noResults")}</p>
      ) : (
        <>
          <section className="mb-4" aria-label={t("checklists.sectionDueToday")}>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {t("checklists.sectionDueToday")}
              <span className="ml-1 text-muted">· {sections.todo.length}</span>
            </h2>
            {sections.todo.length > 0 ? (
              renderTaskList(sections.todo)
            ) : (
              <p className="text-sm text-muted">{t("checklists.todoEmpty")}</p>
            )}
          </section>

          {sections.done.length > 0 ? (
            <section className="mb-4" aria-label={t("checklists.sectionDoneToday")}>
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                {t("checklists.sectionDoneToday")}
                <span className="ml-1 text-muted">· {sections.done.length}</span>
              </h2>
              {renderTaskList(sections.done)}
            </section>
          ) : null}
        </>
      )}

      {sheet ? (
        <ChecklistTaskSheet
          mode={sheet.mode}
          isOwner={isOwner}
          initial={sheet.mode === "create" ? null : sheet.task}
          canComplete={viewingToday}
          onClose={() => setSheet(null)}
          onRemove={
            isOwner && sheet.mode !== "create"
              ? () => setRemoveId(sheet.task.id)
              : undefined
          }
          onSave={
            isOwner && (sheet.mode === "create" || sheet.mode === "edit")
              ? saveDraft
              : undefined
          }
          onSaveComment={
            sheet.mode !== "create" ? saveComment : undefined
          }
          onToggleDone={
            sheet.mode !== "create" && viewingToday
              ? async (draft) => {
                  if (sheet.task.completedToday) {
                    setUncheckTask(sheet.task);
                    return;
                  }
                  await applyToggleChecked(sheet.task, true, draft);
                  setSheet(null);
                }
              : undefined
          }
        />
      ) : null}

      {removeId ? (
        <RemoveConfirmDialog
          title={t("checklists.removeTitle")}
          message={t("checklists.removeMessage")}
          itemLabel={
            tasks.find((row) => row.id === removeId)?.title ??
            t("checklists.taskDetails")
          }
          cancelLabel={t("common.cancel")}
          removeLabel={t("common.delete")}
          onCancel={() => setRemoveId(null)}
          onConfirm={() => void confirmRemove()}
        />
      ) : null}

      {uncheckTask ? (
        <RemoveConfirmDialog
          title={t("checklists.uncheckTitle")}
          message={t("checklists.uncheckMessage")}
          itemLabel={uncheckTask.title}
          cancelLabel={t("common.cancel")}
          removeLabel={t("checklists.uncheckConfirm")}
          onCancel={() => setUncheckTask(null)}
          onConfirm={() => void confirmUncheck()}
        />
      ) : null}
    </div>
  );
}
