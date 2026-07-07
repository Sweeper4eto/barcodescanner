"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminEmptyState,
  adminDangerButtonClass,
  adminPaginationClass,
  adminSearchInputClass,
} from "@/components/admin/admin-ui";
import { PrimaryButton } from "@/components/auth-forms";
import { useT } from "@/components/i18n-provider";
import type { Client } from "@/components/admin/clients-panel";

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  active: boolean;
  clientId: string | null;
  client: { id: string; name: string } | null;
  stores: { id: string; name: string; clientId: string }[];
};

type Store = { id: string; name: string };

type AssignmentState = {
  clientId: string;
  storeIds: string[];
  active: boolean;
};

type Props = {
  clients: Client[];
  onRefresh: () => void;
};

function assignmentFromUser(user: UserRow): AssignmentState {
  return {
    clientId: user.clientId ?? "",
    storeIds: user.stores.map((store) => store.id).sort(),
    active: user.active,
  };
}

function assignmentIsDirty(current: AssignmentState, saved: AssignmentState | null) {
  if (!saved) return false;
  return (
    current.clientId !== saved.clientId ||
    current.active !== saved.active ||
    current.storeIds.join(",") !== saved.storeIds.join(",")
  );
}

export function UsersPanel({ clients, onRefresh }: Props) {
  const { t } = useT();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [clientStores, setClientStores] = useState<Store[]>([]);
  const [savedAssignment, setSavedAssignment] = useState<AssignmentState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (query) params.set("q", query);

    const response = await fetch(`/api/admin/users?${params}`);
    const data = await response.json();
    const list = (data.users ?? []) as UserRow[];
    setUsers(list);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    return list;
  }, [page, query]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function loadClientStores(nextClientId: string) {
    if (!nextClientId) {
      setClientStores([]);
      return;
    }
    const response = await fetch(`/api/admin/stores?clientId=${nextClientId}`);
    const data = await response.json();
    setClientStores(data.stores ?? []);
  }

  function selectUser(user: UserRow) {
    const snapshot = assignmentFromUser(user);
    setSelectedUserId(user.id);
    setClientId(snapshot.clientId);
    setStoreIds(snapshot.storeIds);
    setActive(snapshot.active);
    setSavedAssignment(snapshot);
    setSaveMessage("");
    void loadClientStores(snapshot.clientId);
  }

  async function onClientChange(nextClientId: string) {
    setClientId(nextClientId);
    setStoreIds([]);
    await loadClientStores(nextClientId);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setQuery(search.trim());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const currentAssignment: AssignmentState = {
    clientId,
    storeIds: [...storeIds].sort(),
    active,
  };
  const assignmentDirty = assignmentIsDirty(currentAssignment, savedAssignment);

  useEffect(() => {
    if (assignmentDirty && saveMessage === t("admin.saveSuccess")) {
      setSaveMessage("");
    }
  }, [assignmentDirty, saveMessage, t]);

  async function saveAssignment() {
    if (!selectedUserId || !assignmentDirty) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          clientId: clientId || null,
          storeIds,
          active,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSaveMessage(data.error ?? t("errors.saveFailed"));
        return;
      }
      const list = await loadUsers();
      const updated = list.find((user) => user.id === selectedUserId);
      if (updated) {
        const snapshot = assignmentFromUser(updated);
        setClientId(snapshot.clientId);
        setStoreIds(snapshot.storeIds);
        setActive(snapshot.active);
        setSavedAssignment(snapshot);
        await loadClientStores(snapshot.clientId);
      }
      setSaveMessage(t("admin.saveSuccess"));
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUserId || selectedUser?.role === "ADMIN") return;
    if (!confirm(t("admin.confirmDeleteUser"))) return;

    const response = await fetch(
      `/api/admin/users?userId=${encodeURIComponent(selectedUserId)}`,
      { method: "DELETE" },
    );
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSaveMessage(data.error ?? t("errors.saveFailed"));
      return;
    }

    setSelectedUserId(null);
    setSavedAssignment(null);
    setSaveMessage("");
    await loadUsers();
    onRefresh();
  }

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const safePage = Math.min(page, totalPages);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <section className="min-w-0 rounded-2xl border border-card-border p-4">
        <h2 className="font-medium">{t("admin.allUsers")}</h2>
        <div className="mt-3 flex min-w-0 gap-2">
          <input
            className={adminSearchInputClass}
            placeholder={t("admin.usersSearchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="mt-3 max-h-[32rem] space-y-1.5 overflow-y-auto">
          {users.length === 0 ? (
            <AdminEmptyState message={t("admin.noUsersFound")} />
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => selectUser(user)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${selectedUserId === user.id ? "border-primary bg-selected" : "border-card-border"} ${!user.active ? "opacity-60" : ""}`}
              >
                <p className="font-medium">{user.username}</p>
                <p className="text-xs text-muted">
                  {t("admin.clientRow", {
                    name: user.client?.name ?? t("common.none"),
                  })}
                </p>
              </button>
            ))
          )}
        </div>
        {totalPages > 1 ? (
          <div className={`mt-4 ${adminPaginationClass}`}>
            <p className="text-sm text-muted">
              {t("admin.pageOf", { page: safePage, totalPages })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t("admin.previous")}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="rounded-lg border border-input-border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {t("admin.next")}
              </button>
            </div>
          </div>
        ) : null}
        {total > 0 && totalPages <= 1 ? (
          <p className="mt-3 text-sm text-muted">
            {t("admin.usersTotal", { count: total })}
          </p>
        ) : null}
      </section>

      <section className="min-w-0 rounded-2xl border border-card-border p-4">
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
                className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
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
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              {t("admin.activeUser")}
            </label>
            {saveMessage ? (
              <p
                className={`text-sm ${
                  saveMessage === t("admin.saveSuccess")
                    ? "text-emerald-700"
                    : "text-error"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}
            <PrimaryButton
              disabled={!assignmentDirty || saving}
              onClick={() => void saveAssignment()}
            >
              {saving ? t("admin.saving") : t("common.save")}
            </PrimaryButton>
            {selectedUser.role !== "ADMIN" ? (
              <button
                type="button"
                className={`w-full ${adminDangerButtonClass}`}
                onClick={() => void deleteUser()}
              >
                {t("common.delete")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
