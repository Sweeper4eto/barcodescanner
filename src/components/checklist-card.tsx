"use client";

import { useT } from "@/components/i18n-provider";
import {
  CheckIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";
import type { ChecklistTaskDto } from "@/lib/checklist";

type Props = {
  task: ChecklistTaskDto;
  isOwner: boolean;
  recurrenceLabel: string;
  onOpen: () => void;
  onToggleChecked: () => void;
  onToggleFavourite?: () => void;
  onRemove?: () => void;
};

export function ChecklistCard({
  task,
  isOwner,
  recurrenceLabel,
  onOpen,
  onToggleChecked,
  onToggleFavourite,
  onRemove,
}: Props) {
  const { t } = useT();
  const checked = task.completedToday;
  const dimmed = task.dueToday && checked;

  return (
    <article
      className={`flex w-full overflow-hidden rounded-xl border ${
        checked
          ? "border-primary bg-selected ring-1 ring-primary/50"
          : "app-ticket-gradient"
      }`}
    >
      <div
        className={`w-1 shrink-0 self-stretch ${
          checked ? "bg-primary" : "bg-card-border"
        }`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-start gap-1 px-1 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 self-center">
          {isOwner && onToggleFavourite ? (
            <button
              type="button"
              aria-label={
                task.inFavourites
                  ? t("favourites.remove")
                  : t("favourites.add")
              }
              title={
                task.inFavourites
                  ? t("favourites.remove")
                  : t("favourites.add")
              }
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent ${
                task.inFavourites ? "text-amber-400" : "text-muted"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleFavourite();
              }}
            >
              <StarFavouriteIcon
                className="size-3.5"
                filled={task.inFavourites}
              />
            </button>
          ) : (
            <span className="mt-0.5 size-6 shrink-0" aria-hidden />
          )}

          <button
            type="button"
            aria-label={t("checklists.viewTask")}
            className="min-w-0 flex-1 overflow-hidden text-left"
            onClick={onOpen}
          >
            <p
              title={task.title}
              className={`line-clamp-2 break-words text-sm font-semibold leading-tight ${
                dimmed
                  ? "text-foreground/70 line-through"
                  : "text-foreground"
              }`}
            >
              {task.title}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted">
              {recurrenceLabel}
              {task.dueToday ? ` · ${t("checklists.dueToday")}` : ""}
            </p>
            {checked && task.completedTodayBy ? (
              <p className="text-[10px] leading-tight text-muted">
                {t("checklists.doneBy", {
                  name:
                    task.completedTodayBy.displayName?.trim() ||
                    task.completedTodayBy.username,
                })}
              </p>
            ) : null}
          </button>

          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={!task.dueToday && !checked}
            aria-label={
              checked
                ? t("checklists.markNotDone")
                : t("checklists.markDone")
            }
            title={
              checked
                ? t("checklists.markNotDone")
                : t("checklists.markDone")
            }
            className={`flex h-[2.375rem] w-11 shrink-0 flex-col items-center justify-center rounded-md border px-0.5 py-0.5 text-center transition-colors disabled:opacity-40 ${
              checked
                ? "border-primary bg-selected text-primary"
                : "border-zinc-300/70 bg-transparent text-foreground"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleChecked();
            }}
          >
            <span className="flex h-4 items-center justify-center">
              {checked ? (
                <CheckIcon className="size-3.5 shrink-0" />
              ) : (
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-sm border-2 border-muted"
                />
              )}
            </span>
            <p
              className={`truncate text-[10px] font-semibold leading-none ${
                checked ? "text-primary" : "text-muted"
              }`}
            >
              {t("checklists.done")}
            </p>
          </button>
        </div>

        {isOwner && onRemove ? (
          <button
            type="button"
            aria-label={t("checklists.remove")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-300/70 bg-transparent text-base leading-none text-zinc-300"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        ) : (
          <span className="mt-0.5 size-6 shrink-0" aria-hidden />
        )}
      </div>
    </article>
  );
}
