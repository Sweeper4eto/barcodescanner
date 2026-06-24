"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import type { Client } from "@/components/admin/clients-panel";

type UserRow = {
  id: string;
  username: string;
  active: boolean;
  clientId: string | null;
  client: { id: string; name: string } | null;
  stores: { id: string; name: string; clientId: string }[];
};

type Store = { id: string; name: string };

type Props = {
  clients: Client[];
  onRefresh: () => void;
};

export function UsersPanel({ clients, onRefresh }: Props) {
  const { t } = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [clientStores, setClientStores] = useState<Store[]>([]);

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (!cancelled) setUsers(data.users ?? []);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectUser(user: UserRow) {
    setSelectedUserId(user.id);
    setClientId(user.clientId ?? "");
    setStoreIds(user.stores.map((store) => store.id));
    setActive(user.active);
    if (user.clientId) {
      void fetch(`/api/admin/stores?clientId=${user.clientId}`)
        .then((response) => response.json())
        .then((data) => setClientStores(data.stores ?? []));
    } else {
      setClientStores([]);
    }
  }

  async function onClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setStoreIds([]);
    if (!nextClientId) {
      setClientStores([]);
      return;
    }
    const response = await fetch(`/api/admin/stores?clientId=${nextClientId}`);
    const data = await response.json();
    setClientStores(data.stores ?? []);
  }

  async function saveAssignment() {
    if (!selectedUserId) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUserId,
        clientId: clientId || null,
        storeIds,
        active,
      }),
    });
    await loadUsers();
    onRefresh();
  }

  const selectedUser = users.find((user) => user.id === selectedUserId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-card-border p-4">
        <h2 className="font-medium">{t("admin.allUsers")}</h2>
        <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={`w-full rounded-xl border p-3 text-left ${selectedUserId === user.id ? "border-primary bg-selected" : "border-card-border"} ${!user.active ? "opacity-60" : ""}`}
            >
              <p className="font-medium">{user.username}</p>
              <p className="text-xs text-muted">
                {t("admin.clientRow", {
                  name: user.client?.name ?? t("common.none"),
                })}
              </p>
              <p className="text-xs text-muted">
                {t("admin.storesRow", {
                  names: user.stores.map((s) => s.name).join(", ") || t("common.none"),
                })}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-card-border p-4">
        <h2 className="font-medium">{t("admin.assignment")}</h2>
        {!selectedUser ? (
          <p className="mt-3 text-sm text-muted">{t("admin.selectUser")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              {t("admin.userLabel")}: {selectedUser.username}
            </p>
            <label className="block text-sm">
              {t("admin.clientLabel")}
              <select
                className="mt-1 w-full rounded-xl border border-input-border bg-input text-foreground px-3 py-2"
                value={clientId}
                onChange={(event) => void onClientChange(event.target.value)}
              >
                <option value="">{t("admin.noClient")}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-medium">{t("admin.storesLabel")}</p>
              <div className="mt-2 space-y-1">
                {clientStores.map((store) => (
                  <label key={store.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={storeIds.includes(store.id)}
                      onChange={(event) => {
                        setStoreIds((current) =>
                          event.target.checked
                            ? [...current, store.id]
                            : current.filter((id) => id !== store.id),
                        );
                      }}
                    />
                    {store.name}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              {t("admin.activeUser")}
            </label>
            <PrimaryButton onClick={() => void saveAssignment()}>{t("common.save")}</PrimaryButton>
          </div>
        )}
      </section>
    </div>
  );
}
