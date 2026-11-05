"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HomeIconHub } from "@/components/home-icon-hub";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { BillingReminderDialog } from "@/components/billing-reminder-dialog";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { useT } from "@/components/i18n-provider";
import { useAppSession } from "@/components/app-session-provider";
import { logoutSession } from "@/lib/client-session";
import type { HomeLauncherAvailability } from "@/lib/home-launcher";
import { getStoredStoreId, setStoredStoreId, clearStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

function LogoutIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 16l4-4-4-4" />
      <path d="M19 12H10" />
    </svg>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const { t } = useT();
  const { refresh: refreshSession, homeUser } = useAppSession();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [username, setUsername] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [schedulePublic, setSchedulePublic] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [sessionMissing, setSessionMissing] = useState(false);
  const [whatsNewSettled, setWhatsNewSettled] = useState(false);
  const [isHomeUser, setIsHomeUser] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      async function fetchMe() {
        try {
          const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
          return await response.json().catch(() => ({}));
        } catch {
          return {};
        }
      }

      let data = await fetchMe();
      if (cancelled) return;

      if (!data.user) {
        for (const wait of [100, 300, 600]) {
          await new Promise((r) => setTimeout(r, wait));
          if (cancelled) return;
          data = await fetchMe();
          if (data.user) break;
        }
      }

      if (!data.user) {
        setSessionMissing(true);
        setBootstrapped(true);
        return;
      }

      setSessionMissing(false);
      setUsername(data.user.username);
      const owner = data.user.clientRole === "OWNER";
      setIsOwner(owner);
      setIsHomeUser(Boolean(data.user.homeUser));
      setSchedulePublic(data.user.scheduleAccess === "public");
      setBillingEnabled(false);

      const list: Store[] = data.user.stores ?? [];
      setStores(list);
      const nextUsername = String(data.user.username ?? "");
      const stored = getStoredStoreId(nextUsername);
      const valid = list.find((store) => store.id === stored);
      const nextId = valid?.id ?? list[0]?.id ?? "";
      if (nextId) {
        setStoredStoreId(nextId, nextUsername);
        setStoreId(nextId);
      } else {
        clearStoredStoreId(nextUsername);
        setStoreId("");
      }
      setBootstrapped(true);

      void refreshSession();

      if (owner) {
        void (async () => {
          try {
            const billingRes = await fetch("/api/billing", {
              credentials: "same-origin",
              cache: "no-store",
            });
            if (!cancelled && billingRes.ok) {
              const billing = (await billingRes.json()) as { enabled?: boolean };
              setBillingEnabled(Boolean(billing.enabled));
            }
          } catch {
            /* ignore — home still works without billing tile */
          }
        })();
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, refreshSession]);

  async function logout() {
    await logoutSession();
    router.push("/login");
    router.refresh();
  }

  const greetingTemplate = t("app.greeting", { username: "\u0000" });
  const [greetingBefore, greetingAfter = ""] = greetingTemplate.split("\u0000");

  const availability = useMemo<HomeLauncherAvailability>(() => {
    const business =
      isHomeUser === false || (isHomeUser == null && homeUser === false);
    return {
      schedule: schedulePublic && stores.length > 0,
      team: isOwner && stores.length > 0,
      billing: isOwner && billingEnabled,
      document: business && stores.length > 0,
    };
  }, [
    isHomeUser,
    homeUser,
    schedulePublic,
    stores.length,
    isOwner,
    billingEnabled,
  ]);

  const showHub =
    bootstrapped && !sessionMissing && stores.length > 0 && Boolean(username);

  return (
    <div className="mx-auto flex min-h-[calc(100svh-var(--app-bottom-nav-frame)-env(safe-area-inset-bottom,0px))] w-full max-w-lg flex-col overflow-x-visible px-4 pt-1">
      <MobilePageHeader className="mb-1 shrink-0" />

      <div className="mb-5 flex shrink-0 items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground">
          {bootstrapped ? (
            <>
              <span className="block text-foreground">{greetingBefore.trimEnd()}</span>
              <span className="block text-primary">{username}</span>
              {greetingAfter ? (
                <span className="block text-foreground">{greetingAfter}</span>
              ) : null}
            </>
          ) : null}
        </h1>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          <LogoutIcon />
          <span>{t("common.logout")}</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {!bootstrapped ? (
          <LoadingSpinnerBlock wrapperClassName="flex justify-center py-6" />
        ) : sessionMissing ? (
          <p className="mb-3 rounded-2xl border border-danger-border bg-danger/10 p-4 text-sm text-error">
            Session not found.{" "}
            <Link className="font-medium underline" href="/login">
              {t("auth.login")}
            </Link>
          </p>
        ) : stores.length === 0 ? (
          <div className="mb-3 rounded-2xl bg-warning-bg p-4 text-sm text-warning-fg">
            <p>{t("app.noStores")}</p>
            <Link
              href="/app/contact"
              className="mt-2 inline-flex font-semibold underline underline-offset-2"
            >
              {t("app.noStoresContact")}
            </Link>
          </div>
        ) : null}

        {showHub ? (
          <div className="w-full pt-[clamp(0.35rem,6.5vh,3rem)]">
            <HomeIconHub
              username={username}
              storeId={storeId}
              availability={availability}
            />
          </div>
        ) : null}

        <WhatsNewDialog
          ready={bootstrapped && !sessionMissing}
          onSettled={() => setWhatsNewSettled(true)}
        />
        <BillingReminderDialog
          ready={
            bootstrapped &&
            !sessionMissing &&
            isOwner &&
            billingEnabled
          }
          allowAfterWhatsNew={whatsNewSettled}
        />
      </div>

      {bootstrapped ? (
        <footer className="mt-auto flex shrink-0 flex-col items-center pb-3 pt-6">
          <div className="mb-3 h-px w-40 max-w-[50%] bg-card-border" />
          <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <Link
              href="/terms"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("home.termsLink")}
            </Link>
            <span className="text-primary/50" aria-hidden>
              ·
            </span>
            <Link
              href="/privacy"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {t("home.privacyLink")}
            </Link>
          </nav>
        </footer>
      ) : null}
    </div>
  );
}
