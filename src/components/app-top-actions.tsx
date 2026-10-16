"use client";

import { useMemo } from "react";
import { LanguageSwitch } from "@/components/language-switch";
import { MenuSelect } from "@/components/menu-select";
import { useAppSession } from "@/components/app-session-provider";
import { useT } from "@/components/i18n-provider";
import {
  useAppStoreId,
  useSetAppStoreId,
  useStoreChangeLocked,
} from "@/components/store-selection-provider";

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

/** Language control for the header (flag sits above the store chip). */
export function AppLanguageAction() {
  return <LanguageSwitch />;
}

/** Compact location picker under the language flag (≤30vw via header stack). */
export function AppStoreSelect() {
  const { t } = useT();
  const { user, ready: sessionReady } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const setStoreId = useSetAppStoreId();
  const changeLocked = useStoreChangeLocked();
  const stores = useMemo(() => user?.stores ?? [], [user?.stores]);
  const disabled = stores.length < 2 || changeLocked;

  if (!sessionReady && stores.length === 0) {
    return (
      <span
        aria-hidden
        className="inline-block h-8 w-full rounded-lg border border-card-border/60 bg-card-border/20"
      />
    );
  }

  if (stores.length < 1) return null;

  return (
    <div className="w-full min-w-0">
      <MenuSelect
        size="compact"
        menuAlign="end"
        className="w-full min-w-0"
        label={
          changeLocked ? t("app.selectStoreLocked") : t("app.selectStore")
        }
        value={storeReady ? storeId : ""}
        options={stores.map((store) => ({
          value: store.id,
          label: store.name,
        }))}
        onChange={setStoreId}
        disabled={disabled}
        leadingIcon={<StoreIcon />}
        placeholder={t("app.selectStore")}
      />
    </div>
  );
}

/** Prefer AppLanguageAction + AppStoreSelect stacked in the header. */
export function AppTopActions() {
  return <AppLanguageAction />;
}
