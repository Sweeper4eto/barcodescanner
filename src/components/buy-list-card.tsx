"use client";

import { useT } from "@/components/i18n-provider";
import { ProductImage } from "@/components/product-image";
import {
  MoveToExpiryIcon,
  StarFavouriteIcon,
} from "@/components/app-nav-icons";

type Props = {
  name: string;
  imagePath: string | null;
  enteredAt: string;
  quantity: number;
  favourite?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onMoveToExpiry: () => void;
  onToggleFavourite: () => void;
};

export function BuyListCard({
  name,
  imagePath,
  enteredAt,
  quantity,
  favourite = false,
  onOpen,
  onRemove,
  onMoveToExpiry,
  onToggleFavourite,
}: Props) {
  const { t, dateLocale } = useT();
  const entered = new Date(enteredAt);

  return (
    <article className="relative overflow-visible">
      <button
        type="button"
        aria-label={t("buyList.moveToExpiry")}
        title={t("buyList.moveToExpiry")}
        className="absolute top-0 left-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-card-border bg-card text-muted"
        onClick={(event) => {
          event.stopPropagation();
          onMoveToExpiry();
        }}
      >
        <MoveToExpiryIcon className="h-3 w-3" />
      </button>

      <button
        type="button"
        aria-label={favourite ? t("favourites.remove") : t("favourites.add")}
        title={favourite ? t("favourites.remove") : t("favourites.add")}
        className={`absolute top-0 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-card-border bg-card ${
          favourite ? "text-amber-400" : "text-muted"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavourite();
        }}
      >
        <StarFavouriteIcon className="h-3 w-3" filled={favourite} />
      </button>

      <button
        type="button"
        aria-label={t("buyList.remove")}
        className="absolute top-0 right-0 z-10 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-card-border bg-card text-sm leading-none text-muted"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>

      <div className="flex overflow-hidden rounded-lg border border-card-border bg-card">
        <div className="w-1 shrink-0 bg-primary/30" aria-hidden />

        <button
          type="button"
          aria-label={t("buyList.viewEntry")}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
          onClick={onOpen}
        >
          <ProductImage
            src={imagePath}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
            placeholderClassName="h-10 w-10 shrink-0 rounded-md text-[9px]"
          />

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
              {name}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted">
              {t("buyList.enteredOn")} {entered.toLocaleDateString(dateLocale)}
            </p>
          </div>

          <div className="flex shrink-0 items-stretch gap-1">
            <div className="flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border border-card-border bg-subtle px-1.5 py-0.5 text-center">
              <p className="text-base font-bold leading-none tabular-nums text-foreground">
                {quantity}
              </p>
              <p className="text-[10px] font-semibold leading-none text-muted">
                {t("buyList.pieces")}
              </p>
            </div>
          </div>
        </button>
      </div>
    </article>
  );
}