"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { PushNotifications } from "@/components/push-notifications";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

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
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto min-h-full min-w-0 max-w-lg px-4 py-6">
      <MobilePageHeader title={t("app.workingStore")} />

      <p className="mb-6 text-sm text-muted">
        {bootstrapped ? t("app.greeting", { username }) : null}
      </p>

      {!bootstrapped ? (
        <p className="text-sm text-muted">{t("expiry.loading")}</p>
      ) : stores.length === 0 ? (
        <p className="rounded-xl bg-warning-bg p-4 text-sm text-warning-fg">
          {t("app.noStores")}
        </p>
      ) : null}

      {isOwner ? (
        <Link
          href="/app/team"
          className="mb-4 block rounded-xl border border-card-border bg-card px-4 py-3 text-sm font-medium text-foreground"
        >
          <span className="block">{t("app.team")}</span>
          <span className="mt-0.5 block text-xs font-normal text-muted">
            {t("app.teamHint")}
          </span>
        </Link>
      ) : null}

      <PushNotifications />
    </div>
  );
}
