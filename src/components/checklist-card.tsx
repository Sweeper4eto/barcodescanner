"use client";

import { useT } from "@/components/i18n-provider";
import { CheckIcon } from "@/components/app-nav-icons";
import { ChecklistRecurrencePlaceholder } from "@/components/checklist-recurrence-placeholder";
import type { ChecklistRecurrence, ChecklistTaskDto } from "@/lib/checklist";

export function recurrenceAccentClass(recurrence: ChecklistRecurrence | string): string {
  if (recurrence === "daily") return "text-primary";
  if (recurrence === "weekly") return "text-warning-fg";
  if (recurrence === "monthly") return "text-sky-400";
  return "text-violet-400";
}

type Props = {
  task: ChecklistTaskDto;
  recurrenceLabel: string;
  /** Short label inside the period tile (Дневен / Седмичен / …). */
  recurrenceBadge: string;
  onOpen: () => void;
  onToggleChecked: () => void;
  /** When false, checkbox is disabled (e.g. viewing another day). */
  canToggle?: boolean;
};

export function ChecklistCard({
  task,
  recurrenceLabel,
  recurrenceBadge,
  onOpen,
  onToggleChecked,
  canToggle = true,
}: Props) {
  const { t } = useT();
  const checked = task.completedToday;
  const accent = recurrenceAccentClass(task.recurrence);
  const note = task.note?.trim() ?? "";

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

      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1">
        <button
          type="button"
          aria-label={t("checklists.viewTask")}
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-left"
          onClick={onOpen}
        >
          <ChecklistRecurrencePlaceholder
            recurrence={task.recurrence}
            caption={recurrenceBadge}
            toneClassName={accent}
            className="size-12 shrink-0 rounded-lg"
            title={recurrenceLabel}
            aria-label={recurrenceLabel}
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              title={task.title}
              className={`line-clamp-2 break-words text-sm font-semibold leading-tight ${
                checked
                  ? "text-foreground/70 line-through"
                  : "text-foreground"
              }`}
            >
              {task.title}
            </p>
            {task.assignee ? (
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">
                {t("checklists.assigneeLabel", {
                  name:
                    task.assignee.displayName?.trim() || task.assignee.username,
                })}
              </p>
            ) : null}
            {checked && task.completedTodayBy ? (
              <p className="mt-0.5 truncate text-[10px] leading-tight text-muted">
                {t("checklists.doneBy", {
                  name:
                    task.completedTodayBy.displayName?.trim() ||
                    task.completedTodayBy.username,
                })}
              </p>
            ) : note ? (
              <p
                title={note}
                className="mt-0.5 truncate text-[10px] leading-tight text-muted"
              >
                {note}
              </p>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          disabled={!canToggle || (!task.dueToday && !checked)}
          aria-label={
            checked ? t("checklists.markNotDone") : t("checklists.markDone")
          }
          title={
            checked ? t("checklists.markNotDone") : t("checklists.markDone")
          }
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40 ${
            checked
              ? "border-primary bg-selected text-primary"
              : "border-muted bg-transparent"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleChecked();
          }}
        >
          {checked ? <CheckIcon className="size-3.5" /> : null}
        </button>
      </div>
    </article>
  );
}
