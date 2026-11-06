"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useRef } from "react";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/i18n-provider";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
  formatLocaleDay,
} from "@/lib/expiry";
import { formatAuditCompactWhen } from "@/lib/audit-display";

const LONG_PRESS_MS = 450;

function ActivityMetaHeader({
  username,
  storeName,
  occurredAt,
  trailing,
}: {
  username: string;
  storeName: string | null;
  occurredAt: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-card-border/60 px-2 py-1">
      <p className="min-w-0 flex-1 break-words text-[10px] leading-snug text-muted">
        <time className="tabular-nums text-foreground" dateTime={occurredAt}>
          {formatAuditCompactWhen(occurredAt)}
        </time>
        <span aria-hidden> · </span>
        <span className="font-semibold text-foreground">
          {username.trim() || "—"}
        </span>
        {storeName?.trim() ? (
          <>
            <span aria-hidden> · </span>
            <span className="text-foreground">{storeName.trim()}</span>
          </>
        ) : null}
      </p>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

type Props = {
  name: string;
  username: string;
  storeName: string | null;
  occurredAt: string;
  eventLabel: string;
  eventClassName: string;
  quantity: number | null;
  quantityText: string | null;
  expiryYmd: string | null;
  expiryText: string | null;
  discount: string | null;
  detail: string | null;
  selectionMode?: boolean;
  selected?: boolean;
  selectionDisabled?: boolean;
  showRevert?: boolean;
  showReverted?: boolean;
  onLongPressSelect?: () => void;
  onToggleSelected?: () => void;
  onRevert?: () => void;
};

export function ActivityListCard({
  name,
  username,
  storeName,
  occurredAt,
  eventLabel,
  eventClassName,
  quantity,
  quantityText,
  expiryYmd,
  expiryText,
  discount,
  detail,
  selectionMode = false,
  selected = false,
  selectionDisabled = false,
  showRevert = false,
  showReverted = false,
  onLongPressSelect,
  onToggleSelected,
  onRevert,
}: Props) {
  const { t, dateLocale } = useT();
  const expiry = expiryYmd ? new Date(`${expiryYmd}T12:00:00`) : null;
  const hasValidExpiry = expiry !== null && !Number.isNaN(expiry.getTime());
  const days = hasValidExpiry ? daysUntilExpiry(expiry) : null;
  const absDays = days === null ? 0 : Math.abs(days);
  const daysLabel =
    days === null
      ? ""
      : days === 0
        ? t("expiry.today")
        : absDays === 1
          ? t("expiry.day")
          : t("expiry.days");

  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent) {
    if (selectionMode || !onLongPressSelect || !showRevert) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressTriggered.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      longPressTimer.current = null;
      window.getSelection()?.removeAllRanges();
      onLongPressSelect();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ReactPointerEvent) {
    if (!pointerStart.current || longPressTimer.current === null) return;
    const dx = Math.abs(event.clientX - pointerStart.current.x);
    const dy = Math.abs(event.clientY - pointerStart.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }

  function handlePointerEnd() {
    clearLongPress();
    pointerStart.current = null;
  }

  return (
    <article
      className={`flex w-full touch-manipulation select-none overflow-hidden rounded-xl border transition-colors [-webkit-touch-callout:none] ${
        selected
          ? "border-primary bg-selected ring-1 ring-primary/50"
          : "app-ticket-gradient"
      } ${selectionMode && showRevert ? "cursor-pointer" : ""} ${
        selectionDisabled ? "opacity-45" : ""
      }`}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={
        selectionMode
          ? () => {
              if (longPressTriggered.current) {
                longPressTriggered.current = false;
                return;
              }
              if (!showRevert || selectionDisabled) return;
              onToggleSelected?.();
            }
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(event) => {
        if (showRevert && onLongPressSelect) event.preventDefault();
      }}
    >
      <div
        className={`w-1 shrink-0 self-stretch ${
          hasValidExpiry
            ? expiryUrgencyStripeClass(expiry)
            : "bg-card-border"
        }`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ActivityMetaHeader
          username={username}
          storeName={storeName}
          occurredAt={occurredAt}
          trailing={
            selectionMode && showRevert ? (
              <span
                className={`flex size-5 items-center justify-center rounded-md border text-[10px] font-bold ${
                  selected
                    ? "border-primary bg-selected text-primary"
                    : "border-zinc-300/70 text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
            ) : (
              <span
                className={`inline-block max-w-[9rem] break-words rounded-full px-1.5 py-px text-center text-[0.6rem] font-medium leading-tight ${eventClassName}`}
                title={eventLabel}
              >
                {eventLabel}
              </span>
            )
          }
        />

        <div className="flex min-w-0 items-start gap-1 px-1 py-1">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 self-center">
            <div className="relative size-12 shrink-0">
              <ProductImage
                src={null}
                alt=""
                className="size-12 rounded-lg object-cover"
                placeholderClassName="size-12 rounded-lg text-[9px]"
              />
            </div>

            <div className="flex min-w-0 flex-1 basis-0 items-start gap-1.5 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <p
                  title={name}
                  className="line-clamp-2 break-words text-sm font-semibold leading-tight text-foreground"
                >
                  {name}
                </p>
                {expiryText ? (
                  <p className="mt-0.5 break-words text-[12px] leading-tight text-primary">
                    <span className="text-[10px] font-semibold text-primary/80">
                      {t("expiry.validUntil")}
                    </span>{" "}
                    <span className="font-bold tabular-nums text-primary">
                      {expiryText}
                    </span>
                  </p>
                ) : hasValidExpiry ? (
                  <p className="mt-0.5 whitespace-nowrap text-[12px] leading-tight text-primary">
                    <span className="text-[10px] font-semibold text-primary/80">
                      {t("expiry.validUntil")}
                    </span>{" "}
                    <span className="font-bold tabular-nums text-primary">
                      {formatLocaleDay(expiry, dateLocale)}
                    </span>
                  </p>
                ) : null}
                {discount ? (
                  <p className="text-[10px] font-semibold leading-tight text-primary">
                    {t("team.activityDiscount")} {discount}
                  </p>
                ) : null}
                {detail ? (
                  <p className="break-words text-[10px] leading-tight text-muted">
                    {detail}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-stretch gap-0.5 self-center">
                {quantity !== null || quantityText ? (
                  <div
                    className="flex h-[2.375rem] min-w-9 flex-col items-center justify-center rounded-md border border-zinc-300/70 bg-transparent px-0.5 py-0.5 text-center"
                    title={quantityText ?? undefined}
                  >
                    <p className="text-base font-bold leading-none tabular-nums text-foreground">
                      {quantity ?? "·"}
                    </p>
                    <p className="text-[10px] font-semibold leading-none text-muted">
                      {t("expiry.pieces")}
                    </p>
                  </div>
                ) : null}

                {hasValidExpiry && days !== null ? (
                  <div
                    className={`flex h-[2.375rem] w-9 flex-col items-center justify-center rounded-md border px-0.5 py-0.5 text-center ${expiryUrgencyBadgeClass(expiry)}`}
                  >
                    {days === 0 ? (
                      <p className="text-[10px] font-bold leading-tight">
                        {daysLabel}
                      </p>
                    ) : (
                      <>
                        <p className="text-base font-bold leading-none tabular-nums">
                          {days}
                        </p>
                        <p className="max-w-full truncate text-[10px] font-semibold leading-none">
                          {daysLabel}
                        </p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {!selectionMode && showReverted ? (
            <span className="mt-0.5 shrink-0 self-start text-[0.6rem] font-medium text-muted">
              {t("team.activityAlreadyReverted")}
            </span>
          ) : null}

          {!selectionMode && showRevert ? (
            <button
              type="button"
              aria-label={t("team.activityRevert")}
              title={t("team.activityRevert")}
              className="mt-0.5 flex h-6 shrink-0 items-center justify-center rounded-md border border-primary px-1.5 text-[0.65rem] font-semibold leading-none text-primary"
              onClick={(event) => {
                event.stopPropagation();
                onRevert?.();
              }}
            >
              {t("team.activityRevert")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Simpler ticket for non-product audit rows (login, etc.). */
export function ActivityGenericCard({
  username,
  storeName,
  occurredAt,
  eventLabel,
  eventClassName,
  detail,
}: {
  username: string;
  storeName: string | null;
  occurredAt: string;
  eventLabel: string;
  eventClassName: string;
  detail: string | null;
}) {
  return (
    <article className="flex w-full overflow-hidden rounded-xl border app-ticket-gradient">
      <div className="w-1 shrink-0 self-stretch bg-card-border" aria-hidden />
      <div className="min-w-0 flex-1 flex-col">
        <ActivityMetaHeader
          username={username}
          storeName={storeName}
          occurredAt={occurredAt}
          trailing={
            <span
              className={`inline-block max-w-[9rem] break-words rounded-full px-1.5 py-px text-center text-[0.6rem] font-medium leading-tight ${eventClassName}`}
              title={eventLabel}
            >
              {eventLabel}
            </span>
          }
        />
        {detail ? (
          <p className="break-words px-2.5 py-1.5 text-xs leading-snug text-muted">
            {detail}
          </p>
        ) : null}
      </div>
    </article>
  );
}
