"use client";

import { useT } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import {
  MoveToOrdersIcon,
  PriceReduceIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
  formatLocaleDay,
} from "@/lib/expiry";

type Props = {
  name: string;
  imagePath: string | null;
  articul?: string | null;
  expiryDate: string;
  enteredAt: string;
  quantity: number;
  priceReduced: boolean;
  /** Shown when price is reduced (e.g. 25 → "-25%"). */
  discountPercent?: number | null;
  homeUser?: boolean;
  favourite?: boolean;
  /** View-only cards hide action chips (used in admin store expiry). */
  mode?: "full" | "view";
  onOpen: () => void;
  onRemove: () => void;
  onReducePrice: () => void;
  onMoveToOrders?: () => void;
  onToggleFavourite?: () => void;
};

export function ExpiryListCard({
  name,
  imagePath,
  articul: _articul,
  expiryDate,
  enteredAt,
  quantity,
  priceReduced,
  discountPercent = null,
  homeUser = false,
  favourite = false,
  mode = "full",
  onOpen,
  onRemove,
  onReducePrice,
  onMoveToOrders,
  onToggleFavourite,
}: Props) {
  const { t, dateLocale } = useT();
  const expiry = new Date(expiryDate);
  const entered = new Date(enteredAt);
  const days = daysUntilExpiry(expiry);
  const absDays = Math.abs(days);
  const daysLabel =
    days === 0
      ? t("expiry.today")
      : absDays === 1
        ? t("expiry.day")
        : t("expiry.days");
  const viewOnly = mode === "view";

  return (
    <article className="flex w-full overflow-hidden rounded-xl border border-card-border bg-transparent">
      <div
        className={`w-1 shrink-0 self-stretch ${expiryUrgencyStripeClass(expiry)}`}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 items-start gap-1.5 px-1.5 py-1">
        {!viewOnly && homeUser ? (
          <button
            type="button"
            aria-label={t("expiry.moveToOrders")}
            title={t("expiry.moveToOrders")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onMoveToOrders?.();
            }}
          >
            <MoveToOrdersIcon className="size-3.5" />
          </button>
        ) : null}

        {!homeUser && priceReduced ? (
          viewOnly ? (
            <span
              className="mt-0.5 shrink-0 text-[10px] font-bold leading-none tabular-nums text-primary"
              title={t("expiry.priceReduced")}
              aria-label={t("expiry.priceReduced")}
            >
              −{discountPercent ?? 25}%
            </span>
          ) : (
            <button
              type="button"
              aria-label={t("expiry.editDiscount")}
              title={t("expiry.editDiscount")}
              className="mt-0.5 shrink-0 text-[10px] font-bold leading-none tabular-nums text-primary"
              onClick={(event) => {
                event.stopPropagation();
                onReducePrice();
              }}
            >
              −{discountPercent ?? 25}%
            </button>
          )
        ) : !viewOnly && !homeUser ? (
          <button
            type="button"
            aria-label={t("expiry.reducePrice")}
            title={t("expiry.reducePrice")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onReducePrice();
            }}
          >
            <PriceReduceIcon className="size-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          aria-label={t("expiry.viewEntry")}
          className="flex min-w-0 flex-1 items-center gap-2 self-center text-left"
          onClick={onOpen}
          disabled={viewOnly}
        >
          <ProductImage
            src={imagePath}
            alt=""
            className="size-12 shrink-0 rounded-lg object-cover"
            placeholderClassName="size-12 shrink-0 rounded-lg text-[9px]"
          />

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
              {name}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted">
              {t("expiry.enteredOn")} {formatLocaleDay(entered, dateLocale)}
            </p>
            <p className="text-[13px] leading-tight text-primary">
              <span className="text-[10px] font-semibold text-primary/80">
                {t("expiry.validUntil")}
              </span>{" "}
              <span className="font-bold tabular-nums text-primary">
                {formatLocaleDay(expiry, dateLocale)}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-stretch gap-1">
            <div className="flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border border-card-border bg-transparent px-1.5 py-0.5 text-center">
              <p className="text-base font-bold leading-none tabular-nums text-foreground">
                {quantity}
              </p>
              <p className="text-[10px] font-semibold leading-none text-muted">
                {t("expiry.pieces")}
              </p>
            </div>

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
          </div>
        </button>

        {!viewOnly && homeUser && onToggleFavourite ? (
          <button
            type="button"
            aria-label={favourite ? t("favourites.remove") : t("favourites.add")}
            title={favourite ? t("favourites.remove") : t("favourites.add")}
            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent ${
              favourite ? "text-amber-400" : "text-muted"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavourite();
            }}
          >
            <StarFavouriteIcon className="size-3.5" filled={favourite} />
          </button>
        ) : null}

        {!viewOnly ? (
          <button
            type="button"
            aria-label={t("expiry.remove")}
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-card-border bg-transparent text-base leading-none text-muted"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    </article>
  );
}
