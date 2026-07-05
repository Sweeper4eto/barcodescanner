"use client";

import { useT } from "@/components/i18n-provider";
import {
  daysUntilExpiry,
  expiryUrgencyBadgeClass,
  expiryUrgencyStripeClass,
} from "@/lib/expiry";

type Props = {
  name: string;
  imagePath: string | null;
  expiryDate: string;
  enteredAt: string;
  quantity: number;
  onOpen: () => void;
  onRemove: () => void;
};

export function ExpiryListCard({
  name,
  imagePath,
  expiryDate,
  enteredAt,
  quantity,
  onOpen,
  onRemove,
}: Props) {
  const { t, dateLocale } = useT();
  const expiry = new Date(expiryDate);
  const entered = new Date(enteredAt);
  const days = daysUntilExpiry(expiry);
  const daysLabel =
    days <= 0
      ? t("expiry.today")
      : days === 1
        ? t("expiry.day")
        : t("expiry.days");

  return (
    <article className="relative overflow-visible">
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

        <div className="flex overflow-hidden rounded-lg border border-card-border bg-card">
          <div
            className={`w-1 shrink-0 ${expiryUrgencyStripeClass(expiry)}`}
            aria-hidden
          />

          <button
            type="button"
            aria-label={t("expiry.viewEntry")}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
            onClick={onOpen}
          >
            {imagePath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePath}
                alt=""
                className="h-10 w-10 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-sm font-semibold text-muted"
                aria-hidden
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
                {name}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-foreground">
                <span className="font-bold">{t("expiry.validUntil")}</span>
                {" · "}
                {expiry.toLocaleDateString(dateLocale)}
              </p>
              <p className="text-[10px] leading-tight text-muted">
                {t("expiry.enteredOn")}{" "}
                {entered.toLocaleDateString(dateLocale)}
              </p>
            </div>

            <div className="flex shrink-0 items-stretch gap-1">
              <div className="flex min-w-[2.5rem] flex-col items-center justify-center rounded-md border border-card-border bg-subtle px-1.5 py-0.5 text-center">
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
                {days > 0 ? (
                  <>
                    <p className="text-base font-bold leading-none tabular-nums">{days}</p>
                    <p className="text-[10px] font-semibold leading-none">{daysLabel}</p>
                  </>
                ) : (
                  <p className="text-xs font-bold leading-tight">{daysLabel}</p>
                )}
              </div>
            </div>
          </button>
        </div>
      </article>
  );
}
