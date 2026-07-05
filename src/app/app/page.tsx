"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/language-switch";
import { PushNotifications } from "@/components/push-notifications";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

export default function AppHomePage() {
  const router = useRouter();
  const { t } = useT();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [username, setUsername] = useState("");

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
      const list: Store[] = data.user.stores ?? [];
      setStores(list);
      const stored = getStoredStoreId();
      const valid = list.find((store) => store.id === stored);
      const nextId = valid?.id ?? list[0]?.id ?? "";
      setStoreId(nextId);
      if (nextId) setStoredStoreId(nextId);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function onStoreChange(nextId: string) {
    setStoreId(nextId);
    setStoredStoreId(nextId);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto min-h-full min-w-0 max-w-lg px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted">
            {t("app.greeting", { username })}
          </p>
          <h1 className="break-words text-2xl font-semibold">{t("app.workingStore")}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitch />
          <button
            onClick={() => void logout()}
            className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
          >
            {t("common.logout")}
          </button>
        </div>
      </header>

      <label className="block text-sm font-medium text-foreground">
        {t("app.selectStore")}
        <select
          className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-3 text-base text-foreground"
          value={storeId}
          onChange={(event) => onStoreChange(event.target.value)}
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </label>

      {stores.length === 0 ? (
        <p className="mt-6 rounded-xl bg-warning-bg p-4 text-sm text-warning-fg">
          {t("app.noStores")}
        </p>
      ) : null}

      <PushNotifications />
    </div>
  );
}
