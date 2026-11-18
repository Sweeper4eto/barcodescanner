"use client";

import { useEffect, useState } from "react";
import { CancelButton } from "@/components/cancel-button";
import { ConfirmButton } from "@/components/confirm-button";
import { CameraCapture, uploadImage } from "@/components/camera-capture";
import { MenuSelect } from "@/components/menu-select";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { ProductImage } from "@/components/product-image";
import { CameraIcon, CheckIcon } from "@/components/app-nav-icons";
import { ChecklistRecurrencePlaceholder } from "@/components/checklist-recurrence-placeholder";
import { recurrenceAccentClass } from "@/components/checklist-card";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import {
  appButtonDanger,
  appButtonNeutral,
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appContentMaxW,
  appFooterButtonGrid,
  appFormInput,
} from "@/lib/app-ui";
import type {
  ChecklistAssigneeDto,
  ChecklistRecurrence,
  ChecklistTaskDto,
} from "@/lib/checklist";

export const CHECKLIST_ASSIGNEE_EVERYONE = "everyone";

export type ChecklistDraft = {
  title: string;
  note: string;
  comment: string;
  /** Existing uploaded path, or null to clear. */
  commentImagePath: string | null;
  /** Fresh capture waiting to upload on save. */
  commentImageDataUrl: string | null;
  recurrence: ChecklistRecurrence;
  dueDate: string;
  weekday: number;
  monthDay: number;
  saveAsFavourite: boolean;
  /** `everyone` or a user id. */
  assigneeUserId: string;
};

type Props = {
  mode: "create" | "edit" | "view";
  isOwner: boolean;
  initial?: ChecklistTaskDto | null;
  /** Store members for the assignee picker (owners only). */
  assigneeOptions?: ChecklistAssigneeDto[];
  /** Completing is only allowed for the selected/server "today". */
  canComplete?: boolean;
  onClose: () => void;
  onSave?: (draft: ChecklistDraft) => Promise<void>;
  /** Staff (and owner) saving only the comment field (+ optional photo). */
  onSaveComment?: (draft: {
    comment: string;
    commentImagePath: string | null;
    commentImageDataUrl: string | null;
  }) => Promise<void>;
  onToggleDone?: (draft?: {
    comment: string;
    commentImagePath: string | null;
    commentImageDataUrl: string | null;
  }) => Promise<void>;
  onRemove?: () => void;
};

function emptyDraft(): ChecklistDraft {
  return {
    title: "",
    note: "",
    comment: "",
    commentImagePath: null,
    commentImageDataUrl: null,
    recurrence: "daily",
    dueDate: "",
    weekday: 0,
    monthDay: 1,
    saveAsFavourite: false,
    assigneeUserId: CHECKLIST_ASSIGNEE_EVERYONE,
  };
}

function fromTask(task: ChecklistTaskDto): ChecklistDraft {
  return {
    title: task.title,
    note: task.note ?? "",
    comment: task.comment ?? "",
    commentImagePath: task.commentImagePath ?? null,
    commentImageDataUrl: null,
    recurrence: task.recurrence,
    dueDate: task.dueDate ?? "",
    weekday: task.weekday ?? 0,
    monthDay: task.monthDay ?? 1,
    saveAsFavourite: false,
    assigneeUserId: task.assigneeUserId ?? CHECKLIST_ASSIGNEE_EVERYONE,
  };
}

function periodBadge(
  recurrence: ChecklistRecurrence,
  dueDate: string,
  t: ReturnType<typeof useT>["t"],
): string {
  if (recurrence === "daily") return t("checklists.badgeDaily");
  if (recurrence === "weekly") {
    return `${t("checklists.badgeWeekly")} · ${t("checklists.metaWeekly")}`;
  }
  if (recurrence === "monthly") {
    return `${t("checklists.badgeMonthly")} · ${t("checklists.metaMonthly")}`;
  }
  if (dueDate) {
    const parts = dueDate.split("-");
    if (parts.length === 3) return `${t("checklists.recurrenceOnce")} · ${parts[2]}.${parts[1]}`;
    return `${t("checklists.recurrenceOnce")} · ${dueDate}`;
  }
  return t("checklists.recurrenceOnce");
}

export function ChecklistTaskSheet({
  mode,
  isOwner,
  initial,
  assigneeOptions = [],
  canComplete = true,
  onClose,
  onSave,
  onSaveComment,
  onToggleDone,
  onRemove,
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
  const [addingPhoto, setAddingPhoto] = useState(false);

  useEffect(() => {
    setDraft(initial ? fromTask(initial) : emptyDraft());
    setError(null);
    setAddingPhoto(false);
  }, [initial, mode]);

  const commentPhotoPreview =
    draft.commentImageDataUrl || draft.commentImagePath;

  const recurrenceOptions = [
    { value: "daily" as const, label: t("checklists.recurrenceDaily") },
    { value: "weekly" as const, label: t("checklists.recurrenceWeekly") },
    { value: "monthly" as const, label: t("checklists.recurrenceMonthly") },
    { value: "once" as const, label: t("checklists.recurrenceOnce") },
  ];

  const accent = recurrenceAccentClass(draft.recurrence);
  const statusPending = !initial?.completedToday;

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
      await onSave({ ...draft, title, saveAsFavourite: false });
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
      await onSaveComment({
        comment: draft.comment.trim(),
        commentImagePath: draft.commentImagePath,
        commentImageDataUrl: draft.commentImageDataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleDone() {
    if (!onToggleDone) return;
    setSaving(true);
    setError(null);
    try {
      await onToggleDone({
        comment: draft.comment.trim(),
        commentImagePath: draft.commentImagePath,
        commentImageDataUrl: draft.commentImageDataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const showOwnerSave = editable && onSave;
  const canMarkDone =
    Boolean(onToggleDone) &&
    canComplete &&
    Boolean(initial?.dueToday || initial?.completedToday);
  const showStaffCommentSave = !editable && commentEditable && onSaveComment;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      style={{ paddingTop: offsetTop, paddingBottom: keyboardInset }}
    >
      <div
        className={`mx-auto flex min-h-0 w-full ${appContentMaxW} flex-1 flex-col px-4 pt-1`}
      >
        <MobilePageHeader className="mb-2 shrink-0" onBack={onClose} />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
          {mode === "create" ? (
            <h1 className="text-2xl font-semibold text-foreground">
              {t("checklists.newTask")}
            </h1>
          ) : (
            <>
              <div className={`flex items-center gap-2 ${accent}`}>
                <ChecklistRecurrencePlaceholder
                  recurrence={draft.recurrence}
                  toneClassName={accent}
                  caption={
                    draft.recurrence === "daily"
                      ? t("checklists.badgeDaily")
                      : draft.recurrence === "weekly"
                        ? t("checklists.badgeWeekly")
                        : draft.recurrence === "monthly"
                          ? t("checklists.badgeMonthly")
                          : draft.dueDate
                            ? draft.dueDate.split("-").length === 3
                              ? `${draft.dueDate.split("-")[2]}.${draft.dueDate.split("-")[1]}`
                              : draft.dueDate
                            : t("checklists.recurrenceOnce")
                  }
                  className="size-12 shrink-0 rounded-xl"
                />
                <p className="text-sm font-semibold">
                  {periodBadge(draft.recurrence, draft.dueDate, t)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {editable ? (
                  <input
                    className={`${appFormInput} text-xl font-semibold`}
                    value={draft.title}
                    maxLength={200}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <h1 className="min-w-0 flex-1 text-2xl font-semibold text-foreground">
                    {draft.title}
                  </h1>
                )}
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    statusPending
                      ? "border-card-border text-muted"
                      : "border-primary text-primary"
                  }`}
                >
                  {statusPending
                    ? t("checklists.statusPending")
                    : t("checklists.statusDone")}
                </span>
              </div>
            </>
          )}

          {mode === "create" ? (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-foreground">
                {t("checklists.title")}
              </span>
              <input
                className={appFormInput}
                value={draft.title}
                maxLength={200}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
          ) : null}

          <div className="rounded-2xl border border-card-border px-3 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("checklists.adminDescription")}
            </p>
            {editable ? (
              <textarea
                className={`${appFormInput} min-h-24 resize-y border-0 bg-transparent px-0 py-0`}
                value={draft.note}
                maxLength={2000}
                placeholder={t("checklists.details")}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, note: event.target.value }))
                }
              />
            ) : (
              <p className="text-sm leading-snug text-foreground">
                {draft.note.trim() || t("checklists.noDescription")}
              </p>
            )}
          </div>

          {editable ? (
            <>
              <div className="grid grid-cols-2 items-start gap-2">
                <div className="min-w-0">
                  <MenuSelect
                    label={t("checklists.recurrence")}
                    value={draft.recurrence}
                    options={recurrenceOptions}
                    onChange={(value) =>
                      setDraft((prev) => ({ ...prev, recurrence: value }))
                    }
                  />
                </div>
                <div className="min-w-0">
                  <MenuSelect
                    label={t("checklists.assignee")}
                    value={draft.assigneeUserId}
                    options={[
                      {
                        value: CHECKLIST_ASSIGNEE_EVERYONE,
                        label: t("checklists.assigneeEveryone"),
                      },
                      ...assigneeOptions.map((user) => ({
                        value: user.id,
                        label: user.displayName?.trim() || user.username,
                      })),
                    ]}
                    onChange={(value) =>
                      setDraft((prev) => ({ ...prev, assigneeUserId: value }))
                    }
                    sortByLabel
                    pinnedValues={[CHECKLIST_ASSIGNEE_EVERYONE]}
                    searchable={assigneeOptions.length > 6}
                    searchPlaceholder={t("checklists.assigneeSearch")}
                  />
                </div>
              </div>
              <p className="text-xs text-muted">
                {t("checklists.assigneeHint")}
              </p>

              {draft.recurrence === "once" ? (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-foreground">
                    {t("checklists.date")}
                  </span>
                  <input
                    type="date"
                    className={appFormInput}
                    value={draft.dueDate}
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
            </>
          ) : null}

          {!editable && mode !== "create" ? (
            <p className="text-sm text-muted">
              {t("checklists.assigneeLabel", {
                name: initial?.assignee
                  ? initial.assignee.displayName?.trim() ||
                    initial.assignee.username
                  : t("checklists.assigneeEveryone"),
              })}
            </p>
          ) : null}

          {mode !== "create" ? (
            <div className="space-y-2">
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
              </label>
              {!isOwner ? (
                <p className="text-xs text-muted">
                  {t("checklists.commentStaffHint")}
                </p>
              ) : null}

              <div>
                <p className="mb-1.5 text-sm font-semibold text-foreground">
                  {t("checklists.photo")}
                </p>
                {commentPhotoPreview ? (
                  <ProductImage
                    src={commentPhotoPreview}
                    alt={t("checklists.commentPhoto")}
                    zoomOnDoubleTap
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    placeholderClassName="aspect-[4/3] w-full rounded-xl text-xs"
                  />
                ) : null}
                {commentEditable ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      className={`${appButtonNeutralFull} border-dashed`}
                      disabled={saving}
                      onClick={() => setAddingPhoto(true)}
                    >
                      <CameraIcon className="size-4" />
                      {commentPhotoPreview
                        ? t("checklists.changeCommentPhoto")
                        : t("checklists.addCommentPhoto")}
                    </button>
                    {commentPhotoPreview ? (
                      <button
                        type="button"
                        className={appButtonNeutral}
                        disabled={saving}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            commentImagePath: null,
                            commentImageDataUrl: null,
                          }))
                        }
                      >
                        {t("checklists.removeCommentPhoto")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
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
          {/* Owners edit tasks in this sheet — still need mark-done like staff. */}
          {canMarkDone ? (
            <button
              type="button"
              disabled={saving}
              className={appButtonPrimaryFull}
              onClick={() => void handleToggleDone()}
            >
              <CheckIcon className="size-4" />
              {initial?.completedToday
                ? t("checklists.markNotDone")
                : t("checklists.markDone")}
            </button>
          ) : null}

          {showOwnerSave ? (
            <div className={appFooterButtonGrid}>
              <CancelButton onClick={onClose}>{t("common.cancel")}</CancelButton>
              <ConfirmButton disabled={saving} onClick={() => void handleSave()}>
                {saving ? t("common.loading") : t("common.save")}
              </ConfirmButton>
            </div>
          ) : showStaffCommentSave ? (
            <div className={appFooterButtonGrid}>
              <CancelButton onClick={onClose}>{t("common.cancel")}</CancelButton>
              <ConfirmButton
                disabled={saving}
                onClick={() => void handleSaveComment()}
              >
                {saving ? t("common.loading") : t("common.save")}
              </ConfirmButton>
            </div>
          ) : !canMarkDone ? (
            <CancelButton className="w-full" onClick={onClose}>
              {t("common.ok")}
            </CancelButton>
          ) : null}

          {onRemove ? (
            <button
              type="button"
              className={`w-full ${appButtonDanger}`}
              onClick={onRemove}
            >
              {t("checklists.remove")}
            </button>
          ) : null}
        </div>
      </div>

      {addingPhoto ? (
        <div className="fixed inset-0 z-[70] flex select-none flex-col overflow-y-auto bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <p className="text-center text-sm font-medium text-foreground select-none">
              {t("checklists.addCommentPhoto")}
            </p>
            <CameraCapture
              autoStart
              forceInAppCamera
              captureOnPreviewTap
              confirmMode="instant"
              keepOldPicture={Boolean(commentPhotoPreview)}
              onCapture={(dataUrl) => {
                setDraft((prev) => ({
                  ...prev,
                  commentImageDataUrl: dataUrl,
                }));
                setAddingPhoto(false);
                setError(null);
              }}
              onCancel={() => setAddingPhoto(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Upload draft photo if needed; returns path to persist (or null). */
export async function resolveChecklistCommentImagePath(draft: {
  commentImagePath: string | null;
  commentImageDataUrl: string | null;
}): Promise<string | null> {
  if (draft.commentImageDataUrl) {
    return uploadImage(draft.commentImageDataUrl);
  }
  return draft.commentImagePath;
}
