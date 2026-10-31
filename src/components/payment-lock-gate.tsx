"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import { useViewportInsets } from "@/hooks/use-viewport-insets";
import { appButtonNeutralFull } from "@/lib/app-ui";
import { isPathAllowedWhenPaymentLocked } from "@/lib/payment-lock";
import { logoutSession } from "@/lib/client-session";

function MemberPaymentLockDialog() {
  const { t } = useT();
  const router = useRouter();
  const { offsetTop, keyboardInset } = useViewportInsets();

  async function closeAndLogout() {
    await logoutSession();
    router.replace("/login");
  }

  return (
    <div
      className="fixed inset-x-0 z-[80] flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-6 sm:items-center sm:pb-6"
      style={{ top: offsetTop, bottom: keyboardInset }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-lock-member-title"
    >
      <div className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl border border-card-border bg-background px-5 pb-5 pt-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(ellipse_at_50%_0%,rgb(52_211_153/0.18),transparent_65%)]"
        />
        <div className="relative text-center">
          <h2
            id="payment-lock-member-title"
            className="text-[1.25rem] font-semibold leading-tight text-foreground"
          >
            {t("billing.memberLockTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {t("billing.memberLockBody")}
          </p>
        </div>
        <div className="relative mt-6">
          <button
            type="button"
            onClick={() => void closeAndLogout()}
            className={appButtonNeutralFull}
          >
            {t("billing.memberLockClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Soft payment lock:
 * - Owners → forced onto Billing/Contact only
 * - Members → blocking dialog; Close logs them out
 */
export function PaymentLockGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user } = useAppSession();

  useEffect(() => {
    if (!ready || !user?.paymentLocked) return;
    if (user.clientRole !== "OWNER") return;
    if (isPathAllowedWhenPaymentLocked(pathname)) return;
    router.replace("/app/billing");
  }, [ready, user, pathname, router]);

  if (ready && user?.paymentLocked && user.clientRole !== "OWNER") {
    return (
      <>
        <div aria-hidden className="pointer-events-none select-none opacity-40">
          {children}
        </div>
        <MemberPaymentLockDialog />
      </>
    );
  }

  return <>{children}</>;
}
