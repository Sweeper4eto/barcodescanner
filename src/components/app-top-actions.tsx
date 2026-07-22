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

  const selectedStore = stores.find((store) => store.id === storeId);

  return (
    <div className="inline-flex shrink-0 flex-col items-stretch gap-1.5">
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => void logout()}
          className="shrink-0 rounded-lg border border-input-border bg-card px-2 py-1.5 text-xs text-foreground"
        >
          {t("common.logout")}
        </button>
        <LanguageSwitch />
      </div>
      {stores.length > 1 ? (
        <div className="w-0 min-w-full">
          <label className="sr-only" htmlFor="app-store-select">
            {t("app.selectStore")}
          </label>
          <div className="relative w-full min-w-0">
            <select
              id="app-store-select"
              className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
              value={storeId}
              onChange={(event) => onStoreChange(event.target.value)}
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            <div
              aria-hidden
              className="pointer-events-none flex w-full items-center gap-1 rounded-lg border border-input-border bg-input px-2 py-1.5 pr-1 text-xs text-foreground"
            >
              <span className="min-w-0 flex-1 truncate">
                {selectedStore?.name ?? t("app.selectStore")}
              </span>
              <span className="shrink-0 text-[0.6rem] text-muted">▼</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}