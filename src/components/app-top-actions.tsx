"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

export function AppTopActions() {
  const router = useRouter();
  const { t } = useT();
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (cancelled) return;
      if (!data.user) return;

      const list: Store[] = (data.user.stores ?? []).filter((store: Store) => store.active);
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
  }, []);

  function onStoreChange(nextId: string) {
    setStoreId(nextId);
    setStoredStoreId(nextId);

    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.pathname.startsWith("/app")) {
      url.searchParams.set("storeId", nextId);
      window.location.assign(`${url.pathname}?${url.searchParams.toString()}`);
      return;
    }
    window.location.reload();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-start gap-1.5">
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-lg border border-input-border bg-card px-2 py-1.5 text-xs text-foreground"
      >
        {t("common.logout")}
      </button>
      <div className="flex items-end gap-1.5">
        <LanguageSwitch />
        {stores.length > 1 ? (
          <div className="flex flex-col items-end gap-1">
            <label className="sr-only" htmlFor="app-store-select">
              {t("app.selectStore")}
            </label>
            <select
              id="app-store-select"
              className="max-w-[6.5rem] rounded-lg border border-input-border bg-input px-2 py-1.5 text-xs text-foreground sm:max-w-[8.5rem]"
              value={storeId}
              onChange={(event) => onStoreChange(event.target.value)}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
