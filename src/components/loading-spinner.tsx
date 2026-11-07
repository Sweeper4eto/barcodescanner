"use client";

import type { CSSProperties } from "react";
import { useT } from "@/components/i18n-provider";

const sizePx = {
  sm: "1.25rem",
  md: "1.75rem",
  lg: "2.25rem",
} as const;

type Props = {
  className?: string;
  size?: keyof typeof sizePx;
  /** Accessible label; defaults to common.loading. */
  label?: string;
  style?: CSSProperties;
};

export function LoadingSpinner({
  className = "",
  size = "md",
  label,
  style,
}: Props) {
  const { t } = useT();
  const dimension = sizePx[size];

  return (
    <span
      className={`document-processing-spinner ${className}`.trim()}
      style={{ width: dimension, height: dimension, ...style }}
      role="status"
      aria-label={label ?? t("common.loading")}
    />
  );
}

type BlockProps = Props & {
  wrapperClassName?: string;
};

/** Centered spinner for page sections and empty states. */
export function LoadingSpinnerBlock({
  wrapperClassName = "flex justify-center py-4",
  ...props
}: BlockProps) {
  return (
    <div className={wrapperClassName}>
      <LoadingSpinner {...props} />
    </div>
  );
}

type PageProps = BlockProps & {
  /**
   * true = whole viewport.
   * false = center in the area under the app header chrome.
   */
  fullScreen?: boolean;
};

/**
 * Viewport-centered page wait (fixed). Avoids a short py-* strip that looks
 * tucked under the header when switching hub screens.
 */
export function LoadingSpinnerPage({
  fullScreen = false,
  wrapperClassName = "",
  size = "lg",
  ...props
}: PageProps) {
  const position = fullScreen
    ? "fixed inset-0 z-20"
    : "fixed inset-x-0 z-20 top-[max(6.75rem,calc(env(safe-area-inset-top,0px)+5.75rem))] bottom-[calc(var(--app-bottom-nav-frame,0px)+env(safe-area-inset-bottom,0px))]";

  return (
    <div
      className={`pointer-events-none flex items-center justify-center ${position} ${wrapperClassName}`.trim()}
      aria-busy="true"
    >
      <LoadingSpinner size={size} {...props} />
    </div>
  );
}
