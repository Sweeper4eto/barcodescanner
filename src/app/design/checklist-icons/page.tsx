"use client";

import { useState } from "react";
import {
  CHECKLIST_ICON_PREVIEW_OPTIONS,
  ChecklistIconPreviewTile,
  type ChecklistIconPreviewId,
} from "@/components/checklist-recurrence-icon-previews";
import type { ChecklistRecurrence } from "@/lib/checklist";

const PERIODS: Array<{ id: ChecklistRecurrence; label: string }> = [
  { id: "daily", label: "Daily · 1" },
  { id: "weekly", label: "Weekly · 7" },
  { id: "monthly", label: "Monthly · 31" },
  { id: "once", label: "One-off · clock" },
];

export default function ChecklistIconsDesignPage() {
  const [selected, setSelected] = useState<ChecklistIconPreviewId | null>(
    "calendar",
  );

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 py-8 pb-16">
      <header className="mb-8">
        <p className="text-sm text-primary">Expire365 — preview only</p>
        <h1 className="mt-1 text-2xl font-semibold">
          Checklist period icons — pick a style
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Same mint-glow tile as the no-picture placeholder. Compare options, then
          tell me which letter (A–F) to ship on favourites and list cards.
        </p>
        {selected ? (
          <p className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
            Selected:{" "}
            <strong>
              {
                CHECKLIST_ICON_PREVIEW_OPTIONS.find((o) => o.id === selected)
                  ?.title
              }
            </strong>
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {CHECKLIST_ICON_PREVIEW_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-selected"
                  : "border-card-border bg-transparent"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">
                {option.title}
              </p>
              <p className="mt-1 text-xs text-muted">{option.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {PERIODS.map((period) => (
                  <div key={period.id} className="text-center">
                    <ChecklistIconPreviewTile
                      style={option.id}
                      recurrence={period.id}
                      className="size-16 rounded-xl"
                    />
                    <p className="mt-1.5 text-[10px] text-muted">{period.label}</p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
