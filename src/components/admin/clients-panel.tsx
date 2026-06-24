"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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

type Props = {
  onRefresh: () => void;
};

export function ClientsPanel({ onRefresh }: Props) {
  const { t } = useT();
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

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border border-card-border p-4 lg:col-span-1">
        <h2 className="font-medium">{t("admin.clientsTitle")}</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.searchPlaceholder")}
          />
          <button
            className="rounded-xl bg-invert px-3 py-2 text-sm text-invert-fg"
            onClick={() => void loadClients()}
          >
            {t("common.search")}
          </button>
        </div>
        <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto">
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => selectClient(client)}
              className={`w-full rounded-xl border p-3 text-left ${selectedId === client.id ? "border-primary bg-selected" : "border-card-border"} ${!client.active ? "opacity-60" : ""}`}
            >
              <p className="font-medium">{client.name}</p>
              <p className="text-xs text-muted">{client.phone}</p>
              <p className="text-xs text-muted">
                {t("admin.storesCount", {
                  stores: client._count.stores,
                  users: client._count.users,
                })}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-card-border p-4 lg:col-span-1">
        <h2 className="font-medium">{t("admin.newClient")}</h2>
        <form className="mt-3 space-y-2" onSubmit={createClient}>
          <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.name")} value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} required />
          <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.phone")} value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
          <textarea className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.additionalInfo")} value={newClient.additionalInfo} onChange={(e) => setNewClient({ ...newClient, additionalInfo: e.target.value })} />
          <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("admin.feePerStore")} value={newClient.monthlyFeePerStore} onChange={(e) => setNewClient({ ...newClient, monthlyFeePerStore: e.target.value })} />
          <PrimaryButton type="submit">{t("common.create")}</PrimaryButton>
        </form>

        {selectedId ? (
          <div className="mt-6 space-y-2 border-t pt-4">
            <h3 className="font-medium">{t("admin.editClient")}</h3>
            <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            <textarea className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" value={edit.additionalInfo} onChange={(e) => setEdit({ ...edit, additionalInfo: e.target.value })} />
            <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" value={edit.monthlyFeePerStore} onChange={(e) => setEdit({ ...edit, monthlyFeePerStore: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              {t("admin.activeClient")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <PrimaryButton onClick={() => void saveClient()}>{t("common.save")}</PrimaryButton>
              <button type="button" className="rounded-xl border border-danger-border px-3 py-3 text-error" onClick={() => void deleteClient()}>{t("common.delete")}</button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-card-border p-4 lg:col-span-1">
        <h2 className="font-medium">{t("admin.clientStores")}</h2>
        {!selectedId ? (
          <p className="mt-3 text-sm text-muted">{t("admin.selectClient")}</p>
        ) : (
          <>
            <form className="mt-3 space-y-2" onSubmit={createStore}>
              <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("admin.storeName")} value={newStore.name} onChange={(e) => setNewStore({ ...newStore, name: e.target.value })} required />
              <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.address")} value={newStore.address} onChange={(e) => setNewStore({ ...newStore, address: e.target.value })} />
              <input className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.phone")} value={newStore.phone} onChange={(e) => setNewStore({ ...newStore, phone: e.target.value })} />
              <textarea className="w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2" placeholder={t("common.additionalInfo")} value={newStore.additionalInfo} onChange={(e) => setNewStore({ ...newStore, additionalInfo: e.target.value })} />
              <PrimaryButton type="submit">{t("admin.addStore")}</PrimaryButton>
            </form>
            <div className="mt-4 space-y-2">
              {stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  onToggle={() => void toggleStore(store)}
                  onDelete={() => void deleteStore(store.id)}
                  onSaved={() => selectedId && void loadStores(selectedId)}
                />
              ))}
            </div>
          </>
        )}
      </section>
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
    <div className={`rounded-xl border border-card-border p-3 ${!store.active ? "opacity-60" : ""}`}>
      {editing ? (
        <div className="space-y-2">
          <input className="w-full rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-sm" placeholder={t("common.address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="w-full rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-sm" placeholder={t("common.phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <textarea className="w-full rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-sm" placeholder={t("common.additionalInfo")} value={form.additionalInfo} onChange={(e) => setForm({ ...form, additionalInfo: e.target.value })} />
          <div className="flex gap-2">
            <button className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-fg" onClick={() => void save()}>{t("common.save")}</button>
            <button className="rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-xs" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-medium">{store.name}</p>
          <p className="text-xs text-muted">{store.address}</p>
          <p className="text-xs text-muted">{store.phone}</p>
          <p className="text-xs text-muted">{store.additionalInfo}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-xs" onClick={() => setEditing(true)}>{t("common.edit")}</button>
            <button className="rounded-lg border border-input-border bg-card text-foreground px-2 py-1 text-xs" onClick={onToggle}>
              {store.active ? t("common.deactivate") : t("common.activate")}
            </button>
            <button className="rounded-lg border border-danger-border px-2 py-1 text-xs text-error" onClick={onDelete}>
              {t("common.delete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
