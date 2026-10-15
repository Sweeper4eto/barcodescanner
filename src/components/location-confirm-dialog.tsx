"use client";

import {
  appButtonNeutralFull,
  appButtonPrimaryFull,
  appFooterButtonGrid,
} from "@/lib/app-ui";
import { useViewportInsets } from "@/hooks/use-viewport-insets";

type Props = {
  title: string;
  locationLabel: string;
  locationName: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
};

export function LocationConfirmDialog({
  title,
  locationLabel,
  locationName,
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: Props) {
  const { offsetTop, keyboardInset } = useViewportInsets();

  const bottomNav =
    "var(--app-bottom-nav-frame) + env(safe-area-inset-bottom, 0px)";

  return (
    <div
      className="fixed inset-x-0 z-[70] flex items-center justify-center bg-black/60 px-5"
      style={{
        top: offsetTop,
        bottom: `calc(${bottomNav} + ${keyboardInset}px)`,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-confirm-title"
      onClick={onNo}
    >
      <div
        className="w-full max-w-[22rem] rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
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
          id="location-confirm-title"
          className="mt-4 text-center text-[1.35rem] font-semibold leading-tight text-foreground"
        >
          {title}
        </h2>

        <p className="mt-4 text-center text-sm text-muted">{locationLabel}</p>
        <p className="mt-1 text-center text-4xl font-semibold tracking-tight text-foreground">
          {locationName}
        </p>

        <div className={`mt-6 ${appFooterButtonGrid}`}>
          <button type="button" className={appButtonNeutralFull} onClick={onNo}>
            {noLabel}
          </button>
          <button type="button" className={appButtonPrimaryFull} onClick={onYes}>
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
