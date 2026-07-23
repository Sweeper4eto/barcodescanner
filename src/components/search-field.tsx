"use client";

import type { ReactNode } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  inputClassName?: string;
  /** Extra work after clearing (e.g. close scanner). */
  onClear?: () => void;
  /** Rendered as a pinned button inside the field, at the trailing (end) edge. */
  trailingAction?: ReactNode;
  id?: string;
  name?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
  inputClassName = "",
  onClear,
  trailingAction,
  ...inputProps
}: Props) {
  const { t } = useT();

  function clear() {
    onChange("");
    onClear?.();
  }

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <input
        type="text"
        className={`w-full ${inputClassName}`}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
      {value ? (
        <button
          type="button"
          aria-label={t("common.clearSearch")}
          title={t("common.clearSearch")}
          className="absolute top-0 right-0 z-10 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-card-border bg-card text-sm leading-none text-muted"
          onClick={clear}
        >
          {"\u00d7"}
        </button>
      ) : null}
      {trailingAction ? (
        <div className="absolute top-1/2 right-1 z-10 -translate-y-1/2">
          {trailingAction}
        </div>
      ) : null}
    </div>
  );
}