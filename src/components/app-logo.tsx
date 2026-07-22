"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";

const LOGO_SRC = "/icons/icon-192.png?v=9";

export function AppLogo({
  size = 72,
  className = "",
  link = true,
}: {
  size?: number;
  className?: string;
  link?: boolean;
}) {
  const { t } = useT();

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="expire365"
      width={size}
      height={size}
      className={`rounded-[22%] ${className}`}
      decoding="async"
    />
  );

  if (!link) return image;

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 rounded-[22%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={t("common.home")}
    >
      {image}
    </Link>
  );
}