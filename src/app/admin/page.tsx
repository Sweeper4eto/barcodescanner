"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClientsPanel, type Client } from "@/components/admin/clients-panel";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { UsersPanel } from "@/components/admin/users-panel";
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

  const tabLabels = {
    clients: t("admin.clients"),
    users: t("admin.users"),
    payments: t("admin.payments"),
  };

  return (
    <div className="mx-auto min-h-full max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{t("admin.panel")}</p>
          <h1 className="text-2xl font-semibold">{t("common.appName")}</h1>
        </div>
        <button
          onClick={() => void logout()}
          className="rounded-lg border border-input-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {t("common.logout")}
        </button>
      </header>

      <div className="mb-4 flex gap-2">
        {(["clients", "users", "payments"] as const).map((value) => (
          <button
            key={value}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === value ? "bg-primary text-primary-fg" : "border border-input-border"}`}
            onClick={() => setTab(value)}
          >
            {tabLabels[value]}
          </button>
        ))}
      </div>

      {tab === "clients" ? <ClientsPanel onRefresh={() => void refreshClients()} /> : null}
      {tab === "users" ? <UsersPanel key={refreshKey} clients={clients} onRefresh={() => void refreshClients()} /> : null}
      {tab === "payments" ? <PaymentsPanel /> : null}
    </div>
  );
}
