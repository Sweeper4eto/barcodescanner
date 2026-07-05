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
  onRemove: () => void;
};

export function ExpiryListCard({
  name,
  imagePath,
  expiryDate,
  enteredAt,
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
    <article className="flex overflow-hidden rounded-xl border border-card-border bg-card">
      <div
        className={`w-1 shrink-0 ${expiryUrgencyStripeClass(expiry)}`}
        aria-hidden
      />

      <div className="relative min-w-0 flex-1 p-3">
        <button
          type="button"
          aria-label={t("expiry.remove")}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-card text-xl leading-none text-muted"
          onClick={onRemove}
        >
          ×
        </button>

        <div className="flex items-start gap-3 pr-9">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePath}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-subtle text-lg font-semibold text-muted"
              aria-hidden
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {name}
            </p>
            <p className="mt-1 text-xs text-foreground">
              <span className="font-bold">{t("expiry.validUntil")}</span>
              {" · "}
              {expiry.toLocaleDateString(dateLocale)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {t("expiry.enteredOn")}{" "}
              {entered.toLocaleDateString(dateLocale)}
            </p>
          </div>

          <div
            className={`shrink-0 rounded-lg border px-2 py-1.5 text-center ${expiryUrgencyBadgeClass(expiry)}`}
          >
            {days > 0 ? (
              <>
                <p className="text-xl font-bold leading-none tabular-nums">{days}</p>
                <p className="mt-0.5 text-[11px] font-semibold leading-none">{daysLabel}</p>
              </>
            ) : (
              <p className="text-sm font-bold leading-tight">{daysLabel}</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
