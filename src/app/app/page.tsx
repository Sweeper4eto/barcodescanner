"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobilePageHeader, appPageClassName } from "@/components/mobile-page-header";
import { PushNotifications } from "@/components/push-notifications";
import { useT } from "@/components/i18n-provider";
import { markPwaInstallOffered, shouldOfferPwaInstall } from "@/lib/pwa-install";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

function HomeLinkCard({
  href,
  title,
  hint,
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="mb-3 flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-selected text-primary"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 12h12M12 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>
      </span>
      <span aria-hidden className="text-lg text-primary">
        ›
      </span>
    </Link>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const { t } = useT();
  const [stores, setStores] = useState<Store[]>([]);
  const [username, setUsername] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (cancelled) return;
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUsername(data.user.username);
      setIsOwner(data.user.clientRole === "OWNER");
      const list: Store[] = data.user.stores ?? [];
      setStores(list);
      const stored = getStoredStoreId();
      const valid = list.find((store) => store.id === stored);
      const nextId = valid?.id ?? list[0]?.id ?? "";
      if (nextId) setStoredStoreId(nextId);
      setBootstrapped(true);
      if (shouldOfferPwaInstall()) markPwaInstallOffered();
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const greetingTemplate = t("app.greeting", { username: "\u0000" });
  const [greetingBefore, greetingAfter = ""] = greetingTemplate.split("\u0000");

  return (
    <div className={appPageClassName}>
      <MobilePageHeader className="mb-2" />

      <div className="mb-6 flex items-start justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold leading-tight text-foreground">
          {bootstrapped ? (
            <>
              {greetingBefore}
              <span className="text-primary">{username}</span>
              {greetingAfter}
            </>
          ) : null}
        </h1>
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-primary/50 bg-selected px-3 py-2 text-xs font-semibold text-primary"
        >
          {t("common.logout")}
        </button>
      </div>

      {!bootstrapped ? (
        <p className="text-sm text-muted">{t("expiry.loading")}</p>
      ) : stores.length === 0 ? (
        <p className="rounded-xl bg-warning-bg p-4 text-sm text-warning-fg">
          {t("app.noStores")}
        </p>
      ) : null}

      {isOwner ? (
        <HomeLinkCard
          href="/app/team"
          title={t("app.team")}
          hint={t("app.teamHint")}
        />
      ) : null}

      <HomeLinkCard
        href="/app/contact"
        title={t("app.contact")}
        hint={t("app.contactHint")}
      />

      <PushNotifications />
    </div>
  );
}
