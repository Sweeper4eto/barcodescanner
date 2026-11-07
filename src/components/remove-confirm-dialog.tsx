"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  appButtonDangerFull,
  appButtonWarning,
  appButtonWarningFull,
  appFooterButtonGrid,
} from "@/lib/app-ui";
import { CancelButton } from "@/components/cancel-button";
import { TrashIcon } from "@/components/app-nav-icons";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { clampWriteOffQuantity } from "@/lib/inventory-write-off";

type WriteOffProps = {
  max: number;
  value: number;
  onChange: (qty: number) => void;
  mode: boolean;
  onModeChange: (mode: boolean) => void;
  /** Top-right corner + confirm label when mode is on. */
  actionLabel: string;
  piecesLabel: string;
};

type WriteOffBulkProps = {
  mode: boolean;
  onModeChange: (mode: boolean) => void;
  actionLabel: string;
};

type Props = {
  title: string;
  /** Template containing `{item}` — the item label is rendered bold in place. */
  message: string;
  itemLabel: string;
  cancelLabel: string;
  removeLabel: string;
  busy?: boolean;
  writeOff?: WriteOffProps;
  writeOffBulk?: WriteOffBulkProps;
  onCancel: () => void;
  onConfirm: () => void;
};

function MessageWithItem({
  template,
  item,
}: {
  template: string;
  item: ReactNode;
}) {
  const marker = "{item}";
  const index = template.indexOf(marker);
  if (index < 0) {
    return (
      <>
        {template} <span className="font-semibold text-foreground">{item}</span>
      </>
    );
  }
  return (
    <>
      {template.slice(0, index)}
      <span className="font-semibold text-foreground">{item}</span>
      {template.slice(index + marker.length)}
    </>
  );
}

function QtyPicker({
  max,
  value,
  onChange,
  label,
}: {
  max: number;
  value: number;
  onChange: (qty: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(next: number) {
    const clamped = clampWriteOffQuantity(next, max);
    setDraft(String(clamped));
    onChange(clamped);
  }

  return (
    <div className="flex h-10 w-full items-stretch overflow-hidden rounded-xl border border-warning-fg/70">
      <button
        type="button"
        aria-label="−"
        disabled={value <= 0}
        className="w-10 shrink-0 text-sm text-warning-fg disabled:opacity-30"
        onClick={() => commit(value - 1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        aria-label={label}
        onChange={(event) => {
          const raw = event.target.value.replace(/\D/g, "");
          if (raw === "") {
            setDraft("");
            return;
          }
          const next = clampWriteOffQuantity(
            Number.parseInt(raw, 10) || 0,
            max,
          );
          setDraft(String(next));
          onChange(next);
        }}
        onBlur={() => commit(Number(draft) || 0)}
        className="min-w-0 flex-1 border-x border-warning-fg/70 bg-transparent text-center text-sm font-semibold tabular-nums text-warning-fg outline-none"
      />
      <button
        type="button"
        aria-label="+"
        disabled={value >= max}
        className="w-10 shrink-0 text-sm text-warning-fg disabled:opacity-30"
        onClick={() => commit(value + 1)}
      >
        +
      </button>
    </div>
  );
}

export function RemoveConfirmDialog({
  title,
  message,
  itemLabel,
  cancelLabel,
  removeLabel,
  busy = false,
  writeOff,
  writeOffBulk,
  onCancel,
  onConfirm,
}: Props) {
  const { offsetTop, keyboardInset } = useViewportInsets();
  const writeOffMode = writeOff?.mode ?? writeOffBulk?.mode ?? false;
  const writeOffActionLabel =
    writeOff?.actionLabel ?? writeOffBulk?.actionLabel ?? removeLabel;
  const confirmLabel = writeOffMode ? writeOffActionLabel : removeLabel;
  const confirmClass = writeOffMode
    ? `${appButtonWarningFull} gap-2`
    : `${appButtonDangerFull} gap-2`;

  function toggleWriteOffMode() {
    if (writeOff) {
      writeOff.onModeChange(!writeOff.mode);
      return;
    }
    if (writeOffBulk) {
      writeOffBulk.onModeChange(!writeOffBulk.mode);
    }
  }

  const showCornerToggle = Boolean(writeOff || writeOffBulk);

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-confirm-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="relative w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        {showCornerToggle ? (
          <button
            type="button"
            disabled={busy}
            aria-pressed={writeOffMode}
            className={`${appButtonWarning} absolute right-3 top-3 px-2.5 py-1.5 text-xs ${
              writeOffMode ? "bg-warning-bg" : ""
            }`}
            onClick={toggleWriteOffMode}
          >
            {writeOffActionLabel}
          </button>
        ) : null}

        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png?v=10"
            alt=""
            width={112}
            height={112}
            className="size-28 object-contain"
            decoding="async"
          />
        </div>

        <h2
          id="remove-confirm-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {title}
        </h2>

        <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-muted">
          <MessageWithItem template={message} item={itemLabel} />
        </p>

        {writeOff && writeOff.mode ? (
          <div className="mt-4">
            <QtyPicker
              max={writeOff.max}
              value={writeOff.value}
              onChange={writeOff.onChange}
              label={`${writeOff.actionLabel} (${writeOff.piecesLabel})`}
            />
          </div>
        ) : null}

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <CancelButton disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </CancelButton>
          <button
            type="button"
            disabled={busy}
            className={confirmClass}
            onClick={onConfirm}
          >
            {!writeOffMode ? (
              <TrashIcon className="size-4 shrink-0" />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
