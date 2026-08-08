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
import { SupportRequestsPanel } from "@/components/admin/support-requests-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { AppHeaderLogo } from "@/components/app-header-logo";
import { useT } from "@/components/i18n-provider";

export default function AdminPage() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<
    "clients" | "users" | "payments" | "items" | "support" | "audit"
  >("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [supportNewCount, setSupportNewCount] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    async function loadSupportCount() {
      try {
        const response = await fetch("/api/admin/support/requests?status=new&take=1");
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        setSupportNewCount(data?.counts?.new ?? 0);
      } catch {
        if (!cancelled) setSupportNewCount(0);
      }
    }
    void loadSupportCount();
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
      <div className="mx-auto min-w-0 max-w-6xl overflow-x-visible px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] md:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <AppHeaderLogo size={44} />
            <p className="mt-2 text-sm text-muted">{t("admin.panel")}</p>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("common.appName")}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border border-input-border px-4 py-2 text-sm font-medium text-foreground hover:bg-transparent"
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
                {
                  id: "support" as const,
                  label: (
                    <span className="inline-flex items-center gap-1">
                      <span>{t("support.navLabel")}</span>
                      {supportNewCount > 0 ? (
                        <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] leading-none text-danger-fg">
                          {supportNewCount}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
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
            {tab === "support" ? (
              <SupportRequestsPanel
                onCounts={(counts) => setSupportNewCount(counts.new)}
              />
            ) : null}
            {tab === "audit" ? <AuditLogPanel /> : null}
          </AdminPanelBody>
        </AdminPanel>
      </div>
    </div>
  );
}
