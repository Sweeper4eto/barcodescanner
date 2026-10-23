"use client";

import type { ReactNode } from "react";
import { ForwardArrowIcon } from "@/components/app-nav-icons";
import { LoadingSpinner } from "@/components/loading-spinner";
import { appButtonPrimary, appButtonPrimaryFull } from "@/lib/app-ui";

type Props = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  type?: "button" | "submit";
  fullWidth?: boolean;
  className?: string;
};

export function ForwardButton({
  children,
  onClick,
  disabled,
  busy = false,
  type = "button",
  fullWidth = true,
  className = "",
}: Props) {
  const base = fullWidth ? appButtonPrimaryFull : appButtonPrimary;

  return (
    <button
      type={type}
      disabled={disabled || busy}
      onClick={onClick}
      className={`${base} ${className}`.trim()}
    >
      {busy ? (
        <LoadingSpinner size="sm" className="shrink-0" />
      ) : (
        <ForwardArrowIcon className="size-4 shrink-0" />
      )}
      {children}
    </button>
  );
}
