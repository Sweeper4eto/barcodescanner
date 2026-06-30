"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AdminPanel,
  AdminPanelBody,
  AdminTabBar,
} from "@/components/admin/admin-ui";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { ClientsPanel, type Client } from "@/components/admin/clients-panel";
import { ItemsPanel } from "@/components/admin/items-panel";
import { PaymentsPanel } from "@/components/admin/payments-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { AppLogo } from "@/components/app-logo";
import { useT } from "@/components/i18n-provider";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<
    "clients" | "users" | "payments" | "items" | "audit"
  >("clients");
  const [clients, setClients] = useState<Client[]>([]);

  const refreshClients = useCallback(async () => {
    const response = await fetch("/api/admin/clients");
    const data = await response.json();
    setClients(data.clients ?? []);
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
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo size={44} />
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
            className="rounded-xl border border-input-border px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle"
          >
            {t("common.logout")}
          </button>
        </header>

        <AdminPanel>
          <AdminPanelBody className="pb-0">
            <AdminTabBar
              tabs={[
                { id: "clients" as const, label: t("admin.clients") },
                { id: "users" as const, label: t("admin.users") },
                { id: "payments" as const, label: t("admin.payments") },
                { id: "items" as const, label: t("admin.items") },
                { id: "audit" as const, label: t("admin.auditLog") },
              ]}
              active={tab}
              onChange={setTab}
            />
          </AdminPanelBody>

          <AdminPanelBody className="border-t border-card-border pt-6">
            {tab === "clients" ? (
              <ClientsPanel onRefresh={() => void refreshClients()} />
            ) : null}
            {tab === "users" ? (
              <UsersPanel
                clients={clients}
                onRefresh={() => void refreshClients()}
              />
            ) : null}
            {tab === "payments" ? <PaymentsPanel /> : null}
            {tab === "items" ? <ItemsPanel /> : null}
            {tab === "audit" ? <AuditLogPanel /> : null}
          </AdminPanelBody>
        </AdminPanel>
      </div>
    </div>
  );
}
