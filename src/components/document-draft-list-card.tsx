"use client";

import { MissingInfoIcon } from "@/components/app-nav-icons";
import { ProductImage } from "@/components/product-image";
import { useT } from "@/components/i18n-provider";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
  formatLocaleDay,
} from "@/lib/expiry";
import {
  type DocumentDraftItem,
  draftMissingExpiry,
  draftMissingName,
} from "@/lib/document-draft";

type Props = {
  item: DocumentDraftItem;
  onOpen: () => void;
  onRemove: () => void;
};

export function DocumentDraftListCard({ item, onOpen, onRemove }: Props) {
  const { t, dateLocale } = useT();
  const missingExpiry = draftMissingExpiry(item);
  const displayName = item.name.trim() || t("common.noName");
  const qty = Number(item.quantity);
  const quantityDisplay =
    Number.isInteger(qty) && qty >= 1 ? qty : item.quantity || "1";

  const expiry = !missingExpiry
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

  const stripeClass = missingExpiry
    ? "bg-danger"
    : expiry
      ? expiryUrgencyStripeClass(expiry)
      : "bg-card-border";

  const cardBorderClass = missingExpiry
    ? "border-danger-border bg-danger/5"
    : "border-card-border";

  return (
    <article className="relative overflow-visible">
      {missingExpiry ? (
        <div
          className="absolute top-0 left-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-danger-border bg-danger text-danger-fg"
          title={t("addDocument.missingExpiry")}
          aria-label={t("addDocument.missingExpiry")}
        >
          <MissingInfoIcon className="h-3 w-3" />
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
                draftMissingName(item) ? "text-muted" : "text-foreground"
              }`}
            >
              {displayName}
            </p>
            {expiry ? (
              <p className="mt-0.5 text-[13px] leading-tight text-foreground">
                <span className="text-[10px] font-semibold text-muted">
                  {t("expiry.validUntil")}
                </span>{" "}
                <span className="font-bold tabular-nums">
                  {formatLocaleDay(item.expiryYmd, dateLocale, { utc: true })}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-error">
                {t("addDocument.missingExpiry")}
              </p>
            )}
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