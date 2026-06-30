"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminTabBar } from "@/components/admin/admin-ui";
import { ClientsPanel, type Client } from "@/components/admin/clients-panel";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { AppLogo } from "@/components/app-logo";
import { useT } from "@/components/i18n-provider";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<"clients" | "users" | "payments">("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshClients = useCallback(async () => {
    const response = await fetch("/api/admin/clients");
    const data = await response.json();
    setClients(data.clients ?? []);
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const response = await fetch("/api/admin/clients");
      const data = await response.json();
      if (!cancelled) setClients(data.clients ?? []);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-subtle/40">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-card-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <AppLogo size={48} />
            <div>
              <p className="text-sm text-muted">{t("admin.panel")}</p>
              <h1 className="text-2xl font-semibold text-foreground">
                {t("common.appName")}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-input-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle"
          >
            {t("common.logout")}
          </button>
        </header>

        <div className="mb-5">
          <AdminTabBar
            tabs={[
              { id: "clients" as const, label: t("admin.clients") },
              { id: "users" as const, label: t("admin.users") },
              { id: "payments" as const, label: t("admin.payments") },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>

        <div className="rounded-2xl">
          {tab === "clients" ? (
            <ClientsPanel onRefresh={() => void refreshClients()} />
          ) : null}
          {tab === "users" ? (
            <UsersPanel
              key={refreshKey}
              clients={clients}
              onRefresh={() => void refreshClients()}
            />
          ) : null}
          {tab === "payments" ? <PaymentsPanel /> : null}
        </div>
      </div>
    </div>
  );
}
