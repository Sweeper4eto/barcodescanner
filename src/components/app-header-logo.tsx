"use client";

import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { BrandName } from "@/components/brand-name";
import { useT } from "@/components/i18n-provider";

export function AppHeaderLogo({
  size = 36,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  const { t } = useT();

  return (
    <Link
      href="/app"
      className="inline-flex shrink-0 items-center gap-1.5 overflow-visible focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={t("common.home")}
    >
      <AppLogo size={size} link={false} />
      {showWordmark ? <BrandName className="text-[0.95rem]" /> : null}
    </Link>
  );
}