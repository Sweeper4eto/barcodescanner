"use client";

import { useEffect, useState } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { MenuSelect } from "@/components/menu-select";
import { useT } from "@/components/i18n-provider";
import { getStoredStoreId, setStoredStoreId } from "@/lib/store-selection";

type Store = { id: string; name: string; active: boolean };

function StoreIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10h16l-1.2 9.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 10Z" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function AppTopActions() {
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

      const list: Store[] = (data.user.stores ?? []).filter(
        (store: Store) => store.active,
      );
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

  return (
    <div className="inline-flex min-w-0 max-w-full shrink items-center justify-end gap-1.5">
      {stores.length >= 1 ? (
        <MenuSelect
          size="compact"
          menuAlign="end"
          className="min-w-0 max-w-[11.5rem] flex-1"
          label={t("app.selectStore")}
          value={storeId}
          options={stores.map((store) => ({
            value: store.id,
            label: store.name,
          }))}
          onChange={onStoreChange}
          disabled={stores.length < 2}
          leadingIcon={<StoreIcon />}
          placeholder={t("app.selectStore")}
        />
      ) : null}
      <LanguageSwitch />
    </div>
  );
}
