"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  SCHEDULE_CLOSE_MIN,
  SCHEDULE_OPEN_MIN,
  SCHEDULE_SPAN_MIN,
  SCHEDULE_STEP_MIN,
  clampScheduleMinutes,
  formatDurationMinutes,
  formatMinutesAsClock,
} from "@/lib/schedule";

export function initials(username: string): string {
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

function mergeCoverageRanges(
  ranges: { startMin: number; endMin: number }[],
): { startMin: number; endMin: number }[] {
  const sorted = [...ranges]
    .filter((r) => r.endMin > r.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const merged: { startMin: number; endMin: number }[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.startMin > last.endMin) {
      merged.push({ ...range });
    } else {
      last.endMin = Math.max(last.endMin, range.endMin);
    }
  }
  return merged;
}

function coveredMinutes(
  ranges: { startMin: number; endMin: number }[],
): number {
  return ranges.reduce((sum, r) => sum + (r.endMin - r.startMin), 0);
}

export function DayCoverageBar({
  ranges,
  hoursUnit,
  minutesUnit,
  labelFull,
  labelPartial,
  labelEmpty,
}: {
  ranges: { startMin: number; endMin: number }[];
  hoursUnit: string;
  minutesUnit: string;
  labelFull: string;
  labelPartial: string;
  labelEmpty: string;
}) {
  const merged = mergeCoverageRanges(ranges);
  const covered = coveredMinutes(merged);
  const full = covered >= SCHEDULE_SPAN_MIN;
  const empty = covered <= 0;
  const coveredLabel = formatDurationLabel(covered, hoursUnit, minutesUnit);
  const totalLabel = formatDurationLabel(
    SCHEDULE_SPAN_MIN,
    hoursUnit,
    minutesUnit,
  );
  const status = full
    ? labelFull
    : empty
      ? labelEmpty
      : labelPartial
          .replace("{covered}", coveredLabel)
          .replace("{total}", totalLabel);

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p
          className={`min-w-0 text-xs font-semibold ${
            full ? "text-primary" : "text-muted"
          }`}
        >
          {status}
        </p>
        <p className="shrink-0 text-[0.65rem] tabular-nums text-muted">
          {formatMinutesAsClock(SCHEDULE_OPEN_MIN)}–
          {formatMinutesAsClock(SCHEDULE_CLOSE_MIN)}
        </p>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full border border-card-border bg-card-border/25">
        {merged.map((range) => (
          <div
            key={`${range.startMin}-${range.endMin}`}
            aria-hidden
            className={`absolute top-0 bottom-0 ${
              full ? "bg-primary" : "bg-primary/75"
            }`}
            style={{
              left: `${leftPct(range.startMin)}%`,
              width: `${widthPct(range.startMin, range.endMin)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function minutesFromClientX(
  track: HTMLDivElement | null,
  clientX: number,
): number {
  if (!track) return SCHEDULE_OPEN_MIN;
  const rect = track.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return clampScheduleMinutes(SCHEDULE_OPEN_MIN + pct * SCHEDULE_SPAN_MIN);
}

function formatDurationLabel(
  totalMin: number,
  hoursUnit: string,
  minutesUnit: string,
): string {
  return formatDurationMinutes(totalMin, hoursUnit, minutesUnit);
}

/**
 * Per-member day bar: green = assigned shift (owner can drag when editable).
 */
export function MemberShiftBar({
  assigned,
  editable,
  disabled,
  onCommit,
  onLiveChange,
}: {
  assigned: { startMin: number; endMin: number } | null;
  editable: boolean;
  disabled?: boolean;
  onCommit: (startMin: number, endMin: number) => void;
  onLiveChange?: (startMin: number, endMin: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragWhich = useRef<"start" | "end" | null>(null);
  const [draft, setDraft] = useState(assigned);
  const draftRef = useRef(draft);
  const liveCb = useRef(onLiveChange);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    liveCb.current = onLiveChange;
  }, [onLiveChange]);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const assignedStart = assigned?.startMin;
  const assignedEnd = assigned?.endMin;
  useEffect(() => {
    setDraft(
      assignedStart != null && assignedEnd != null
        ? { startMin: assignedStart, endMin: assignedEnd }
        : null,
    );
  }, [assignedStart, assignedEnd]);

  function applyDrag(which: "start" | "end", clientX: number) {
    const minutes = minutesFromClientX(trackRef.current, clientX);
    const current =
      draftRef.current ?? { startMin: 10 * 60, endMin: 16 * 60 };
    const next =
      which === "start"
        ? {
            startMin: Math.min(minutes, current.endMin - SCHEDULE_STEP_MIN),
            endMin: current.endMin,
          }
        : {
            startMin: current.startMin,
            endMin: Math.max(minutes, current.startMin + SCHEDULE_STEP_MIN),
          };
    draftRef.current = next;
    setDraft(next);
    liveCb.current?.(next.startMin, next.endMin);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const which = dragWhich.current;
    if (!which || !editable || disabled) return;
    applyDrag(which, event.clientX);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const which = dragWhich.current;
    dragWhich.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (which && draftRef.current) {
      onCommitRef.current(draftRef.current.startMin, draftRef.current.endMin);
    }
  }

  function handleStartDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable || disabled) return;
    event.preventDefault();
    dragWhich.current = "start";
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag("start", event.clientX);
  }

  function handleEndDown(event: PointerEvent<HTMLButtonElement>) {
    if (!editable || disabled) return;
    event.preventDefault();
    dragWhich.current = "end";
    event.currentTarget.setPointerCapture(event.pointerId);
    applyDrag("end", event.clientX);
  }

  const show =
    draft ?? assigned ?? (editable ? { startMin: 10 * 60, endMin: 16 * 60 } : null);
  /** Green block is only a suggestion until a shift is saved / draft dragged. */
  const provisional = Boolean(editable && !assigned && !draft && show);

  return (
    <div ref={trackRef} className="relative h-6 touch-none select-none rounded-md border border-card-border/70 bg-transparent">
      {show ? (
        <div
          aria-hidden
          className={`absolute top-0.5 bottom-0.5 z-[1] rounded-sm border border-primary ${
            provisional
              ? "border-dashed bg-primary/15"
              : "bg-primary/35"
          }`}
          style={{
            left: `${leftPct(show.startMin)}%`,
            width: `${widthPct(show.startMin, show.endMin)}%`,
          }}
        />
      ) : null}
      {editable && show ? (
        <>
          <button
            type="button"
            disabled={disabled}
            aria-label="Start"
            className="absolute top-1/2 z-[3] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background disabled:opacity-50"
            style={{ left: `${leftPct(show.startMin)}%` }}
            onPointerDown={handleStartDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          <button
            type="button"
            disabled={disabled}
            aria-label="End"
            className="absolute top-1/2 z-[3] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background disabled:opacity-50"
            style={{ left: `${leftPct(show.endMin)}%` }}
            onPointerDown={handleEndDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </>
      ) : null}
    </div>
  );
}

function formatShiftSummary(
  range: { startMin: number; endMin: number },
  hoursUnit: string,
  minutesUnit: string,
): string {
  const duration = formatDurationLabel(
    range.endMin - range.startMin,
    hoursUnit,
    minutesUnit,
  );
  return `${formatMinutesAsClock(range.startMin)}–${formatMinutesAsClock(range.endMin)} · ${duration}`;
}

export function MemberHoursLabel({
  personId,
  assigned,
  liveByUser,
  hoursUnit,
  minutesUnit,
}: {
  personId: string;
  assigned: { startMin: number; endMin: number } | null;
  liveByUser: Record<string, { startMin: number; endMin: number }>;
  hoursUnit: string;
  minutesUnit: string;
}) {
  const live = liveByUser[personId];
  const range = live ?? assigned;
  if (range) {
    return (
      <span className="shrink-0 text-right text-xs tabular-nums text-muted">
        {formatShiftSummary(range, hoursUnit, minutesUnit)}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-right text-xs tabular-nums text-muted">—</span>
  );
}
