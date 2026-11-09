"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChecklistCard } from "@/components/checklist-card";
import {
  ChecklistTaskSheet,
  type ChecklistDraft,
} from "@/components/checklist-task-sheet";
import { StarFavouriteIcon } from "@/components/app-nav-icons";
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
  type ChecklistFavouriteDto,
  type ChecklistTaskDto,
} from "@/lib/checklist";

type ListResponse = {
  todayYmd: string;
  isOwner: boolean;
  dueTodayIncomplete: number;
  favourites: ChecklistFavouriteDto[];
  tasks: ChecklistTaskDto[];
  error?: string;
};

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

export default function ChecklistsPage() {
  const { t } = useT();
  const { ready: sessionReady, homeUser } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const [tasks, setTasks] = useState<ChecklistTaskDto[]>([]);
  const [favourites, setFavourites] = useState<ChecklistFavouriteDto[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingFavouriteId, setAddingFavouriteId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sheet, setSheet] = useState<
    | { mode: "create" }
    | { mode: "edit" | "view"; task: ChecklistTaskDto }
    | null
  >(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

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
      setFavourites([]);
      setLoading(false);
      return;
    }
    if (!storeId) {
      setTasks([]);
      setFavourites([]);
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
        setFavourites([]);
        return;
      }
      setTasks(data.tasks ?? []);
      setFavourites(data.favourites ?? []);
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

  const filteredFavourites = useMemo(() => {
    if (!searchQuery) return favourites;
    return favourites.filter((favourite) => {
      const title = favourite.title.toLowerCase();
      const note = (favourite.note ?? "").toLowerCase();
      return title.includes(searchQuery) || note.includes(searchQuery);
    });
  }, [favourites, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    return tasks.filter((task) => {
      const title = task.title.toLowerCase();
      const note = (task.note ?? "").toLowerCase();
      return title.includes(searchQuery) || note.includes(searchQuery);
    });
  }, [tasks, searchQuery]);

  const sections = useMemo(() => {
    const dueToday = filteredTasks.filter(
      (task) => task.dueToday && !task.completedToday,
    );
    const upcoming = filteredTasks.filter(
      (task) => !task.dueToday && !task.completedToday,
    );
    const doneToday = filteredTasks.filter((task) => task.completedToday);
    return { dueToday, upcoming, doneToday };
  }, [filteredTasks]);

  async function toggleChecked(task: ChecklistTaskDto) {
    const next = !task.completedToday;
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
      const res = await fetch(`/api/checklists/${task.id}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
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

  async function addFavouriteToList(favourite: ChecklistFavouriteDto) {
    if (!storeId) return;
    setAddingFavouriteId(favourite.id);
    try {
      const res = await fetch("/api/checklists/favourites", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, favouriteId: favourite.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        task?: ChecklistTaskDto;
        created?: boolean;
        error?: string;
      };
      if (!res.ok || !data.task) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setTasks((prev) => {
        if (prev.some((row) => row.id === data.task!.id)) {
          return prev.map((row) =>
            row.id === data.task!.id ? data.task! : row,
          );
        }
        return [data.task!, ...prev];
      });
      setSheet(null);
    } finally {
      setAddingFavouriteId(null);
    }
  }

  async function toggleFavouriteCatalog(task: ChecklistTaskDto) {
    if (!isOwner || !storeId) return;
    if (task.inFavourites) {
      const match = favourites.find(
        (row) =>
          row.title.trim().toLowerCase() === task.title.trim().toLowerCase(),
      );
      if (!match) {
        await load();
        return;
      }
      setFavourites((prev) => prev.filter((row) => row.id !== match.id));
      setTasks((prev) =>
        prev.map((row) =>
          row.title.trim().toLowerCase() === task.title.trim().toLowerCase()
            ? { ...row, inFavourites: false }
            : row,
        ),
      );
      try {
        const res = await fetch(`/api/checklists/favourites/${match.id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) await load();
      } catch {
        await load();
      }
      return;
    }

    try {
      const res = await fetch("/api/checklists/favourites", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          title: task.title,
          note: task.note,
          recurrence: task.recurrence,
          dueDate: task.dueDate,
          weekday: task.weekday,
          monthDay: task.monthDay,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        favourite?: ChecklistFavouriteDto;
      };
      if (!res.ok || !data.favourite) {
        await load();
        return;
      }
      setFavourites((prev) => [data.favourite!, ...prev.filter((row) => row.id !== data.favourite!.id)]);
      setTasks((prev) =>
        prev.map((row) =>
          row.title.trim().toLowerCase() === task.title.trim().toLowerCase()
            ? { ...row, inFavourites: true }
            : row,
        ),
      );
    } catch {
      await load();
    }
  }

  async function saveDraft(draft: ChecklistDraft) {
    if (!storeId) throw new Error(t("errors.missingStoreId"));
    const body = {
      storeId,
      title: draft.title,
      note: draft.note || null,
      comment: draft.comment || null,
      recurrence: draft.recurrence,
      dueDate: draft.recurrence === "once" ? draft.dueDate : null,
      weekday: null,
      monthDay: null,
      saveAsFavourite: draft.saveAsFavourite,
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
        favourite?: ChecklistFavouriteDto | null;
        error?: string;
      };
      if (!res.ok || !data.task) {
        throw new Error(data.error || t("errors.invalidData"));
      }
      setTasks((prev) => [data.task!, ...prev]);
      if (data.favourite) {
        setFavourites((prev) => [
          data.favourite!,
          ...prev.filter((row) => row.id !== data.favourite!.id),
        ]);
      }
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

  async function saveComment(comment: string) {
    if (!sheet || sheet.mode === "create") return;
    const taskId = sheet.task.id;
    const res = await fetch(`/api/checklists/${taskId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment || null }),
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
    setSheet({ mode: isOwner ? "edit" : "view", task: data.task });
  }

  async function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setRemoveId(null);
    setTasks((prev) => prev.filter((row) => row.id !== id));
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

  async function removeFavourite(favourite: ChecklistFavouriteDto) {
    if (!isOwner) return;
    setFavourites((prev) => prev.filter((row) => row.id !== favourite.id));
    setTasks((prev) =>
      prev.map((row) =>
        row.title.trim().toLowerCase() === favourite.title.trim().toLowerCase()
          ? { ...row, inFavourites: false }
          : row,
      ),
    );
    try {
      const res = await fetch(`/api/checklists/favourites/${favourite.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) await load();
    } catch {
      await load();
    }
  }

  function renderSection(title: string, rows: ChecklistTaskDto[]) {
    if (rows.length === 0) return null;
    return (
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
        <ul className="space-y-2">
          {rows.map((task) => (
            <li key={task.id}>
              <ChecklistCard
                task={task}
                isOwner={isOwner}
                recurrenceLabel={recurrenceLabel(task, t)}
                onOpen={() =>
                  setSheet({
                    mode: isOwner ? "edit" : "view",
                    task,
                  })
                }
                onToggleChecked={() => void toggleChecked(task)}
                onToggleFavourite={
                  isOwner ? () => void toggleFavouriteCatalog(task) : undefined
                }
                onRemove={isOwner ? () => setRemoveId(task.id) : undefined}
              />
            </li>
          ))}
        </ul>
      </section>
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

  return (
    <div className={`${appPageShell} relative ${appListInset} pb-24 pt-1`}>
      <div className={appPageTopGlowClass} aria-hidden />
      <MobilePageHeader className="mb-2" />

      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("checklists.titlePage")}
        </h1>
        {isOwner ? (
          <button
            type="button"
            className={appButtonPrimary}
            onClick={() => setSheet({ mode: "create" })}
          >
            {t("checklists.add")}
          </button>
        ) : null}
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

      {error ? (
        <p className="mb-3 rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      {favourites.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-card-border px-3 py-3 text-sm text-muted">
          {isOwner
            ? t("checklists.favouritesEmptyOwner")
            : t("checklists.favouritesEmptyStaff")}
        </p>
      ) : filteredFavourites.length > 0 ? (
        <section className="mb-4" aria-label={t("checklists.sectionFavourites")}>
          <div className="mb-1.5 flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
              {t("checklists.sectionFavourites")}
            </h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary">
              {filteredFavourites.length}
              {searchQuery && filteredFavourites.length !== favourites.length
                ? `/${favourites.length}`
                : ""}
            </span>
          </div>
          <div className="-mx-1.5 flex gap-2 overflow-x-auto px-1.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filteredFavourites.map((favourite) => (
              <div
                key={favourite.id}
                className="relative flex w-[5.75rem] shrink-0 flex-col rounded-lg border border-card-border bg-transparent p-1.5"
              >
                {isOwner ? (
                  <button
                    type="button"
                    aria-label={t("favourites.remove")}
                    title={t("favourites.remove")}
                    className="absolute -right-0.5 -top-0.5 z-10 flex size-5 items-center justify-center rounded-md border border-card-border bg-background/95 text-amber-400"
                    onClick={() => void removeFavourite(favourite)}
                  >
                    <StarFavouriteIcon className="size-3" filled />
                  </button>
                ) : (
                  <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center text-amber-400">
                    <StarFavouriteIcon className="size-3" filled />
                  </span>
                )}
                <button
                  type="button"
                  disabled={addingFavouriteId === favourite.id}
                  onClick={() => void addFavouriteToList(favourite)}
                  title={t("checklists.addFromFavourite")}
                  aria-label={`${t("checklists.addFromFavourite")}: ${favourite.title}`}
                  className="flex min-h-[4.25rem] flex-col gap-1 px-0.5 pt-1 text-left disabled:opacity-60"
                >
                  <span className="line-clamp-3 text-[11px] font-semibold leading-snug text-foreground">
                    {addingFavouriteId === favourite.id
                      ? t("checklists.addingFavourite")
                      : favourite.title}
                  </span>
                  <span className="mt-auto text-[10px] text-muted">
                    {t("checklists.addFromFavourite")}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <h2 className="mb-2 text-sm font-semibold text-foreground">
        {t("checklists.sectionList")}
      </h2>

      {tasks.length === 0 && !error ? (
        <p className="text-sm text-muted">{t("checklists.empty")}</p>
      ) : filteredTasks.length === 0 ? (
        <p className="text-sm text-muted">{t("checklists.noResults")}</p>
      ) : (
        <>
          {renderSection(t("checklists.sectionDueToday"), sections.dueToday)}
          {renderSection(t("checklists.sectionUpcoming"), sections.upcoming)}
          {renderSection(t("checklists.sectionDoneToday"), sections.doneToday)}
        </>
      )}

      {sheet ? (
        <ChecklistTaskSheet
          mode={sheet.mode}
          isOwner={isOwner}
          initial={sheet.mode === "create" ? null : sheet.task}
          favouriteChoices={sheet.mode === "create" ? favourites : undefined}
          onClose={() => setSheet(null)}
          onAddFavouriteToList={
            sheet.mode === "create" ? addFavouriteToList : undefined
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
            sheet.mode !== "create"
              ? async () => {
                  await toggleChecked(sheet.task);
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
    </div>
  );
}
