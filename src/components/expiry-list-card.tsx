"use client";

import { useT } from "@/components/i18n-provider";
import { daysUntilExpiry, expiryUrgencyClass } from "@/lib/expiry";

type Props = {
  name: string;
  imagePath: string | null;
  expiryDate: string;
  onRemove: () => void;
};

export function ExpiryListCard({ name, imagePath, expiryDate, onRemove }: Props) {
  const { t, dateLocale } = useT();
  const expiry = new Date(expiryDate);
  const days = daysUntilExpiry(expiry);
  const daysLabel =
    days <= 0
      ? t("expiry.today")
      : days === 1
        ? t("expiry.day")
        : t("expiry.days");

  return (
    <div
      className={`flex gap-2.5 rounded-xl border p-2.5 ${expiryUrgencyClass(expiry)}`}
    >
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {days > 0 ? (
              <>
                <p className="text-3xl font-bold leading-none tabular-nums text-foreground">
                  {days}
                </p>
                <p className="mt-0.5 text-base font-semibold leading-none text-foreground">
                  {daysLabel}
                </p>
              </>
            ) : (
              <p className="text-xl font-bold leading-none text-foreground">
                {daysLabel}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{t("expiry.validUntil")}</p>
            <p className="text-sm font-medium leading-tight text-foreground">
              {expiry.toLocaleDateString(dateLocale)}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-danger-border bg-card px-2 py-1 text-xs font-medium text-error"
            onClick={onRemove}
          >
            {t("expiry.remove")}
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-muted">{name}</p>
      </div>
    </div>
  );
}
