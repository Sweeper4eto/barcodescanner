"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  AdminField,
  AdminSection,
  AdminTabBar,
  adminInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  additionalInfo: string | null;
  active: boolean;
  monthlyFeePerStore: number;
  _count: { stores: number; users: number };
};

type Store = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  additionalInfo: string | null;
  active: boolean;
};

type ClientsSubview = "current" | "new";

type Props = {
  onRefresh: () => void;
};

export function ClientsPanel({ onRefresh }: Props) {
  const { t } = useT();
  const [subview, setSubview] = useState<ClientsSubview>("current");
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [edit, setEdit] = useState({
    name: "",
    phone: "",
    additionalInfo: "",
    monthlyFeePerStore: "0",
    active: true,
  });
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    additionalInfo: "",
    monthlyFeePerStore: "10",
  });
  const [newStore, setNewStore] = useState({
    name: "",
    address: "",
    phone: "",
    additionalInfo: "",
  });

  const loadClients = useCallback(async (search = query) => {
    const response = await fetch(
      `/api/admin/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`,
    );
    const data = await response.json();
    setClients(data.clients ?? []);
  }, [query]);

  const loadStores = useCallback(async (clientId: string) => {
    const response = await fetch(`/api/admin/stores?clientId=${clientId}`);
    const data = await response.json();
    setStores(data.stores ?? []);
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

  function selectClient(client: Client) {
    setSelectedId(client.id);
    setEdit({
      name: client.name,
      phone: client.phone ?? "",
      additionalInfo: client.additionalInfo ?? "",
      monthlyFeePerStore: String(client.monthlyFeePerStore),
      active: client.active,
    });
    void loadStores(client.id);
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClient.name,
        phone: newClient.phone || undefined,
        additionalInfo: newClient.additionalInfo || undefined,
        monthlyFeePerStore: Number(newClient.monthlyFeePerStore),
      }),
    });
    setNewClient({ name: "", phone: "", additionalInfo: "", monthlyFeePerStore: "10" });
    await loadClients();
    onRefresh();
    setSubview("current");
  }

  async function saveClient() {
    if (!selectedId) return;
    await fetch("/api/admin/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedId,
        name: edit.name,
        phone: edit.phone || undefined,
        additionalInfo: edit.additionalInfo || undefined,
        monthlyFeePerStore: Number(edit.monthlyFeePerStore),
        active: edit.active,
      }),
    });
    await loadClients();
    onRefresh();
  }

  async function deleteClient() {
    if (!selectedId || !confirm(t("admin.confirmDeleteClient"))) return;
    await fetch(`/api/admin/clients?id=${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    await loadClients();
    onRefresh();
  }

  async function createStore(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedId, ...newStore }),
    });
    setNewStore({ name: "", address: "", phone: "", additionalInfo: "" });
    await loadStores(selectedId);
    await loadClients();
    onRefresh();
  }

  async function toggleStore(store: Store) {
    await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: store.id, active: !store.active }),
    });
    if (selectedId) await loadStores(selectedId);
    onRefresh();
  }

  async function deleteStore(storeId: string) {
    if (!confirm(t("admin.confirmDeleteStore"))) return;
    await fetch(`/api/admin/stores?id=${storeId}`, { method: "DELETE" });
    if (selectedId) await loadStores(selectedId);
    await loadClients();
    onRefresh();
  }

  const selectedClient = clients.find((client) => client.id === selectedId);

  return (
    <div className="space-y-5">
      <AdminTabBar
        tabs={[
          { id: "current" as const, label: t("admin.currentClients") },
          { id: "new" as const, label: t("admin.newClient") },
        ]}
        active={subview}
        onChange={setSubview}
      />

      {subview === "new" ? (
        <AdminSection
          title={t("admin.newClient")}
          description={t("admin.newClientHint")}
          className="mx-auto max-w-xl"
        >
          <form className="space-y-4" onSubmit={createClient}>
            <AdminField label={t("common.name")}>
              <input
                className={adminInputClass}
                value={newClient.name}
                onChange={(event) =>
                  setNewClient({ ...newClient, name: event.target.value })
                }
                required
              />
            </AdminField>
            <AdminField label={t("common.phone")}>
              <input
                className={adminInputClass}
                value={newClient.phone}
                onChange={(event) =>
                  setNewClient({ ...newClient, phone: event.target.value })
                }
              />
            </AdminField>
            <AdminField label={t("common.additionalInfo")}>
              <textarea
                className={`${adminInputClass} min-h-24`}
                value={newClient.additionalInfo}
                onChange={(event) =>
                  setNewClient({ ...newClient, additionalInfo: event.target.value })
                }
              />
            </AdminField>
            <AdminField label={t("admin.feePerStore")}>
              <input
                className={adminInputClass}
                inputMode="decimal"
                value={newClient.monthlyFeePerStore}
                onChange={(event) =>
                  setNewClient({ ...newClient, monthlyFeePerStore: event.target.value })
                }
              />
            </AdminField>
            <PrimaryButton type="submit">{t("common.create")}</PrimaryButton>
          </form>
        </AdminSection>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(280px,320px)_1fr]">
          <AdminSection
            title={t("admin.currentClients")}
            description={t("admin.currentClientsHint")}
          >
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadClients();
              }}
            >
              <input
                className={`${adminInputClass} flex-1`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("admin.searchPlaceholder")}
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg"
              >
                {t("common.search")}
              </button>
            </form>
            <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {clients.length === 0 ? (
                <AdminEmptyState message={t("admin.noClientsFound")} />
              ) : (
                clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selectedId === client.id
                        ? "border-primary bg-selected shadow-sm"
                        : "border-card-border hover:border-primary/40 hover:bg-subtle"
                    } ${!client.active ? "opacity-60" : ""}`}
                  >
                    <p className="font-medium text-foreground">{client.name}</p>
                    {client.phone ? (
                      <p className="mt-1 text-xs text-muted">{client.phone}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      {t("admin.storesCount", {
                        stores: client._count.stores,
                        users: client._count.users,
                      })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </AdminSection>

          <div className="grid gap-5 xl:grid-cols-2">
            {!selectedId ? (
              <div className="xl:col-span-2">
                <AdminEmptyState message={t("admin.selectClient")} />
              </div>
            ) : (
              <>
                <AdminSection
                  title={t("admin.editClient")}
                  description={selectedClient?.name}
                >
                  <div className="space-y-4">
                    <AdminField label={t("common.name")}>
                      <input
                        className={adminInputClass}
                        value={edit.name}
                        onChange={(event) =>
                          setEdit({ ...edit, name: event.target.value })
                        }
                      />
                    </AdminField>
                    <AdminField label={t("common.phone")}>
                      <input
                        className={adminInputClass}
                        value={edit.phone}
                        onChange={(event) =>
                          setEdit({ ...edit, phone: event.target.value })
                        }
                      />
                    </AdminField>
                    <AdminField label={t("common.additionalInfo")}>
                      <textarea
                        className={`${adminInputClass} min-h-20`}
                        value={edit.additionalInfo}
                        onChange={(event) =>
                          setEdit({ ...edit, additionalInfo: event.target.value })
                        }
                      />
                    </AdminField>
                    <AdminField label={t("admin.feePerStore")}>
                      <input
                        className={adminInputClass}
                        inputMode="decimal"
                        value={edit.monthlyFeePerStore}
                        onChange={(event) =>
                          setEdit({ ...edit, monthlyFeePerStore: event.target.value })
                        }
                      />
                    </AdminField>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={edit.active}
                        onChange={(event) =>
                          setEdit({ ...edit, active: event.target.checked })
                        }
                      />
                      {t("admin.activeClient")}
                    </label>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <PrimaryButton onClick={() => void saveClient()}>
                        {t("common.save")}
                      </PrimaryButton>
                      <button
                        type="button"
                        className="rounded-xl border border-danger-border px-3 py-3 text-sm font-medium text-error"
                        onClick={() => void deleteClient()}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                </AdminSection>

                <AdminSection title={t("admin.clientStores")}>
                  <form className="space-y-3" onSubmit={createStore}>
                    <AdminField label={t("admin.storeName")}>
                      <input
                        className={adminInputClass}
                        value={newStore.name}
                        onChange={(event) =>
                          setNewStore({ ...newStore, name: event.target.value })
                        }
                        required
                      />
                    </AdminField>
                    <AdminField label={t("common.address")}>
                      <input
                        className={adminInputClass}
                        value={newStore.address}
                        onChange={(event) =>
                          setNewStore({ ...newStore, address: event.target.value })
                        }
                      />
                    </AdminField>
                    <AdminField label={t("common.phone")}>
                      <input
                        className={adminInputClass}
                        value={newStore.phone}
                        onChange={(event) =>
                          setNewStore({ ...newStore, phone: event.target.value })
                        }
                      />
                    </AdminField>
                    <AdminField label={t("common.additionalInfo")}>
                      <textarea
                        className={`${adminInputClass} min-h-16`}
                        value={newStore.additionalInfo}
                        onChange={(event) =>
                          setNewStore({ ...newStore, additionalInfo: event.target.value })
                        }
                      />
                    </AdminField>
                    <PrimaryButton type="submit">{t("admin.addStore")}</PrimaryButton>
                  </form>
                  <div className="mt-4 space-y-2">
                    {stores.length === 0 ? (
                      <p className="text-sm text-muted">{t("admin.noStoresYet")}</p>
                    ) : (
                      stores.map((store) => (
                        <StoreCard
                          key={store.id}
                          store={store}
                          onToggle={() => void toggleStore(store)}
                          onDelete={() => void deleteStore(store.id)}
                          onSaved={() => selectedId && void loadStores(selectedId)}
                        />
                      ))
                    )}
                  </div>
                </AdminSection>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StoreCard({
  store,
  onToggle,
  onDelete,
  onSaved,
}: {
  store: Store;
  onToggle: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    additionalInfo: store.additionalInfo ?? "",
  });

  async function save() {
    await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: store.id,
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        additionalInfo: form.additionalInfo || undefined,
      }),
    });
    setEditing(false);
    onSaved();
  }

  return (
    <div
      className={`rounded-xl border border-card-border bg-subtle/60 p-3 ${!store.active ? "opacity-60" : ""}`}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-input-border bg-card px-2 py-1 text-sm text-foreground"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-input-border bg-card px-2 py-1 text-sm text-foreground"
            placeholder={t("common.address")}
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-input-border bg-card px-2 py-1 text-sm text-foreground"
            placeholder={t("common.phone")}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <textarea
            className="w-full rounded-lg border border-input-border bg-card px-2 py-1 text-sm text-foreground"
            placeholder={t("common.additionalInfo")}
            value={form.additionalInfo}
            onChange={(event) =>
              setForm({ ...form, additionalInfo: event.target.value })
            }
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-fg"
              onClick={() => void save()}
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-input-border bg-card px-2 py-1 text-xs text-foreground"
              onClick={() => setEditing(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium">{store.name}</p>
          <p className="text-xs text-muted">{store.address}</p>
          <p className="text-xs text-muted">{store.phone}</p>
          <p className="text-xs text-muted">{store.additionalInfo}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-input-border bg-card px-2 py-1 text-xs text-foreground"
              onClick={() => setEditing(true)}
            >
              {t("common.edit")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-input-border bg-card px-2 py-1 text-xs text-foreground"
              onClick={onToggle}
            >
              {store.active ? t("common.deactivate") : t("common.activate")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-danger-border px-2 py-1 text-xs text-error"
              onClick={onDelete}
            >
              {t("common.delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
