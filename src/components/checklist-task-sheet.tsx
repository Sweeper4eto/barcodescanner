"use client";

import { useEffect, useState } from "react";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { MenuSelect } from "@/components/menu-select";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { StarFavouriteIcon } from "@/components/app-nav-icons";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  appContentMaxW,
  appFooterButtonGrid,
  appFormInput,
} from "@/lib/app-ui";
import type {
  ChecklistFavouriteDto,
  ChecklistRecurrence,
  ChecklistTaskDto,
} from "@/lib/checklist";

export type ChecklistDraft = {
  title: string;
  note: string;
  comment: string;
  recurrence: ChecklistRecurrence;
  dueDate: string;
  weekday: number;
  monthDay: number;
  saveAsFavourite: boolean;
};

type Props = {
  mode: "create" | "edit" | "view";
  isOwner: boolean;
  initial?: ChecklistTaskDto | null;
  favouriteChoices?: ChecklistFavouriteDto[];
  onClose: () => void;
  onSave?: (draft: ChecklistDraft) => Promise<void>;
  /** Staff (and owner) saving only the comment field. */
  onSaveComment?: (comment: string) => Promise<void>;
  onToggleDone?: () => Promise<void>;
  /** Pull favourite into the working list (create mode). */
  onAddFavouriteToList?: (favourite: ChecklistFavouriteDto) => Promise<void>;
};

function emptyDraft(): ChecklistDraft {
  return {
    title: "",
    note: "",
    comment: "",
    recurrence: "daily",
    dueDate: "",
    weekday: 0,
    monthDay: 1,
    saveAsFavourite: false,
  };
}

function fromTask(task: ChecklistTaskDto): ChecklistDraft {
  return {
    title: task.title,
    note: task.note ?? "",
    comment: task.comment ?? "",
    recurrence: task.recurrence,
    dueDate: task.dueDate ?? "",
    weekday: task.weekday ?? 0,
    monthDay: task.monthDay ?? 1,
    saveAsFavourite: task.inFavourites,
  };
}

export function ChecklistTaskSheet({
  mode,
  isOwner,
  initial,
  favouriteChoices = [],
  onClose,
  onSave,
  onSaveComment,
  onToggleDone,
  onAddFavouriteToList,
}: Props) {
  const { t } = useT();
  const { offsetTop, keyboardInset } = useViewportInsets();
  const editable = isOwner && (mode === "create" || mode === "edit");
  const commentEditable = Boolean(onSaveComment) || editable;
  const [draft, setDraft] = useState<ChecklistDraft>(() =>
    initial ? fromTask(initial) : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ? fromTask(initial) : emptyDraft());
    setError(null);
  }, [initial, mode]);

  const recurrenceOptions = [
    { value: "daily" as const, label: t("checklists.recurrenceDaily") },
    { value: "weekly" as const, label: t("checklists.recurrenceWeekly") },
    { value: "monthly" as const, label: t("checklists.recurrenceMonthly") },
    { value: "once" as const, label: t("checklists.recurrenceOnce") },
  ];

  async function handleSave() {
    if (!onSave) return;
    const title = draft.title.trim();
    if (!title) {
      setError(t("checklists.titleRequired"));
      return;
    }
    if (draft.recurrence === "once" && !draft.dueDate) {
      setError(t("checklists.dateRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...draft, title });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveComment() {
    if (!onSaveComment) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveComment(draft.comment.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function handlePullFavourite(favourite: ChecklistFavouriteDto) {
    if (!onAddFavouriteToList) return;
    setSaving(true);
    setError(null);
    try {
      await onAddFavouriteToList(favourite);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const showOwnerSave = editable && onSave;
  const showStaffCommentSave = !editable && commentEditable && onSaveComment;
  const showMarkDone =
    !showOwnerSave &&
    !showStaffCommentSave &&
    onToggleDone &&
    Boolean(initial?.dueToday);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      style={{ paddingTop: offsetTop, paddingBottom: keyboardInset }}
    >
      <div className={`mx-auto flex min-h-0 w-full ${appContentMaxW} flex-1 flex-col px-4 pt-1`}>
        <MobilePageHeader className="mb-2 shrink-0" />
        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          {mode === "create"
            ? t("checklists.newTask")
            : editable
              ? t("checklists.editTask")
              : t("checklists.taskDetails")}
        </h1>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
          {mode === "create" && favouriteChoices.length > 0 ? (
            <section aria-label={t("checklists.pickFavourite")}>
              <p className="mb-1.5 text-sm font-semibold text-foreground">
                {t("checklists.pickFavourite")}
              </p>
              <p className="mb-2 text-xs text-muted">
                {t("checklists.pickFavouriteHint")}
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {favouriteChoices.map((favourite) => (
                  <button
                    key={favourite.id}
                    type="button"
                    disabled={saving || !onAddFavouriteToList}
                    onClick={() => void handlePullFavourite(favourite)}
                    className="flex w-[7.5rem] shrink-0 flex-col gap-1 rounded-xl border border-card-border bg-transparent px-2.5 py-2 text-left disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <StarFavouriteIcon className="size-3.5" filled />
                      <span className="text-[10px] font-semibold text-muted">
                        {t("checklists.addFromFavourite")}
                      </span>
                    </span>
                    <span className="line-clamp-3 text-xs font-semibold leading-snug text-foreground">
                      {favourite.title}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foreground">
              {t("checklists.title")}
            </span>
            <input
              className={appFormInput}
              value={draft.title}
              disabled={!editable}
              maxLength={200}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-foreground">
              {t("checklists.details")}
            </span>
            <textarea
              className={`${appFormInput} min-h-24 resize-y`}
              value={draft.note}
              disabled={!editable}
              maxLength={2000}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, note: event.target.value }))
              }
            />
          </label>

          {mode !== "create" || editable ? (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">
                {t("checklists.comment")}
              </span>
              <textarea
                className={`${appFormInput} min-h-24 resize-y`}
                value={draft.comment}
                disabled={!commentEditable}
                maxLength={2000}
                placeholder={t("checklists.commentPlaceholder")}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    comment: event.target.value,
                  }))
                }
              />
              {!isOwner ? (
                <p className="mt-1 text-xs text-muted">
                  {t("checklists.commentStaffHint")}
                </p>
              ) : null}
            </label>
          ) : null}

          {editable ? (
            <MenuSelect
              label={t("checklists.recurrence")}
              value={draft.recurrence}
              options={recurrenceOptions}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, recurrence: value }))
              }
            />
          ) : (
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground">
                {t("checklists.recurrence")}:{" "}
              </span>
              {
                recurrenceOptions.find((o) => o.value === draft.recurrence)
                  ?.label
              }
            </p>
          )}

          {draft.recurrence === "once" ? (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">
                {t("checklists.date")}
              </span>
              <input
                type="date"
                className={appFormInput}
                value={draft.dueDate}
                disabled={!editable}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    dueDate: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}

          {draft.recurrence === "weekly" ? (
            <p className="text-sm text-muted">
              {t("checklists.recurrenceWeeklyHint")}
            </p>
          ) : null}

          {draft.recurrence === "monthly" ? (
            <p className="text-sm text-muted">
              {t("checklists.recurrenceMonthlyHint")}
            </p>
          ) : null}

          {editable && mode === "create" ? (
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                draft.saveAsFavourite
                  ? "border-primary text-primary"
                  : "border-card-border text-foreground"
              }`}
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  saveAsFavourite: !prev.saveAsFavourite,
                }))
              }
            >
              <StarFavouriteIcon
                className="size-4"
                filled={draft.saveAsFavourite}
              />
              {draft.saveAsFavourite
                ? t("checklists.willSaveFavourite")
                : t("checklists.saveAsFavourite")}
            </button>
          ) : null}

          {initial?.completedToday && initial.completedTodayBy ? (
            <p className="text-sm text-muted">
              {t("checklists.doneBy", {
                name:
                  initial.completedTodayBy.displayName?.trim() ||
                  initial.completedTodayBy.username,
              })}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-danger-border bg-danger/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {showStaffCommentSave && onToggleDone && initial?.dueToday ? (
            <ConfirmButton
              className="w-full"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onToggleDone().finally(() => setSaving(false));
              }}
            >
              {initial.completedToday
                ? t("checklists.markNotDone")
                : t("checklists.markDone")}
            </ConfirmButton>
          ) : null}
          <div className={appFooterButtonGrid}>
            <CancelButton onClick={onClose}>{t("common.cancel")}</CancelButton>
            {showOwnerSave ? (
              <ConfirmButton
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? t("common.loading") : t("common.save")}
              </ConfirmButton>
            ) : showStaffCommentSave ? (
              <ConfirmButton
                disabled={saving}
                onClick={() => void handleSaveComment()}
              >
                {saving ? t("common.loading") : t("common.save")}
              </ConfirmButton>
            ) : showMarkDone ? (
              <ConfirmButton
                disabled={saving}
                onClick={() => {
                  setSaving(true);
                  void onToggleDone!().finally(() => setSaving(false));
                }}
              >
                {initial?.completedToday
                  ? t("checklists.markNotDone")
                  : t("checklists.markDone")}
              </ConfirmButton>
            ) : (
              <ConfirmButton onClick={onClose}>{t("common.ok")}</ConfirmButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
