"use client";

import { MissingInfoIcon, WarningIcon } from "@/components/app-nav-icons";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
  formatLocaleDay,
} from "@/lib/expiry";
import {
  type DocumentDraftItem,
  type DocumentDraftWarning,
  draftHasMissingInfo,
  draftHasWarnings,
  draftMissingExpiry,
  draftMissingName,
  draftWarnings,
} from "@/lib/document-draft";

type Props = {
  item: DocumentDraftItem;
  onOpen: () => void;
  onRemove: () => void;
};

function warningLabel(
  warning: DocumentDraftWarning,
  t: (key: MessageKey) => string,
): string {
  switch (warning) {
    case "invalidBarcode":
      return t("addDocument.warnInvalidBarcode");
    case "noProductMatch":
      return t("addDocument.warnNoProductMatch");
    case "expiryPast":
      return t("addDocument.warnExpiryPast");
    case "expiryFarFuture":
      return t("addDocument.warnExpiryFarFuture");
    case "quantityHigh":
      return t("addDocument.warnQuantityHigh");
    default:
      return t("addDocument.checkRow");
  }
}

export function DocumentDraftListCard({ item, onOpen, onRemove }: Props) {
  const { t, dateLocale } = useT();
  const hasMissing = draftHasMissingInfo(item);
  const warnings = draftWarnings(item);
  const hasWarnings = draftHasWarnings(item);
  const missingSummary = [
    draftMissingName(item) ? t("addDocument.missingName") : null,
    draftMissingExpiry(item) ? t("addDocument.missingExpiry") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const warningSummary = warnings.map((w) => warningLabel(w, t)).join(" · ");
  const displayName = item.name.trim() || t("common.noName");
  const qty = Number(item.quantity);
  const quantityDisplay =
    Number.isInteger(qty) && qty >= 1 ? qty : item.quantity || "1";

  const expiryOk = !draftMissingExpiry(item);
  const expiry = expiryOk
    ? new Date(`${item.expiryYmd}T00:00:00.000Z`)
    : null;
  const days = expiry ? daysUntilExpiry(expiry) : 0;
  const absDays = Math.abs(days);
  const daysLabel =
    days === 0
      ? t("expiry.today")
      : absDays === 1
        ? t("expiry.day")
        : t("expiry.days");

  const stripeClass = hasMissing
    ? "bg-danger"
    : hasWarnings
      ? "bg-[var(--urgency-warning-border)]"
      : expiry
        ? expiryUrgencyStripeClass(expiry)
        : "bg-card-border";

  const cardBorderClass = hasMissing
    ? "border-danger-border bg-danger/5"
    : hasWarnings
      ? "border-[var(--urgency-warning-border)] bg-[var(--urgency-warning-bg)]"
      : "border-card-border";

  return (
    <article className="relative overflow-visible">
      {hasMissing ? (
        <div
          className="absolute top-0 left-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-danger-border bg-danger text-danger-fg"
          title={missingSummary}
          aria-label={missingSummary}
        >
          <MissingInfoIcon className="h-3 w-3" />
        </div>
      ) : hasWarnings ? (
        <div
          className="absolute top-0 left-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--urgency-warning-border)] bg-[var(--urgency-warning-bg)] text-warning-fg"
          title={warningSummary}
          aria-label={warningSummary}
        >
          <WarningIcon className="h-3 w-3" />
        </div>
      ) : null}

      <button
        type="button"
        aria-label={t("expiry.remove")}
        className="absolute top-0 right-0 z-10 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-card-border bg-card text-sm leading-none text-muted"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>

      <div
        className={`flex overflow-hidden rounded-lg border bg-card ${cardBorderClass}`}
      >
        <div className={`w-1 shrink-0 ${stripeClass}`} aria-hidden />

        <button
          type="button"
          aria-label={t("addDocument.editItem")}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
          onClick={onOpen}
        >
          <ProductImage
            src={item.productImagePath}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
            placeholderClassName="h-10 w-10 shrink-0 rounded-md text-[9px]"
          />

          <div className="min-w-0 flex-1">
            <p
              className={`line-clamp-2 text-xs font-semibold leading-tight ${
                draftMissingName(item) ? "text-error" : "text-foreground"
              }`}
            >
              {displayName}
            </p>
            {hasMissing ? (
              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-error">
                {missingSummary}
              </p>
            ) : hasWarnings ? (
              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-warning-fg">
                {warningSummary}
              </p>
            ) : expiry ? (
              <p className="mt-0.5 text-[13px] leading-tight text-foreground">
                <span className="text-[10px] font-semibold text-muted">
                  {t("expiry.validUntil")}
                </span>
                {" "}
                <span className="font-bold tabular-nums">
                  {formatLocaleDay(item.expiryYmd, dateLocale, { utc: true })}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-stretch gap-1">
            <div className="flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border border-card-border bg-subtle px-1.5 py-0.5 text-center">
              <p className="text-base font-bold leading-none tabular-nums text-foreground">
                {quantityDisplay}
              </p>
              <p className="text-[10px] font-semibold leading-none text-muted">
                {t("expiry.pieces")}
              </p>
            </div>

            {expiry ? (
              <div
                className={`flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border px-1.5 py-0.5 text-center ${expiryUrgencyBadgeClass(expiry)}`}
              >
                {days !== 0 ? (
                  <>
                    <p className="text-base font-bold leading-none tabular-nums">
                      {days}
                    </p>
                    <p className="text-[10px] font-semibold leading-none">
                      {daysLabel}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-bold leading-tight">{daysLabel}</p>
                )}
              </div>
            ) : (
              <div className="flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border border-danger-border bg-danger/10 px-1 py-0.5 text-center text-error">
                <MissingInfoIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        </button>
      </div>
    </article>
  );
}
