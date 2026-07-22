"use client";

import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { navigateApp } from "@/lib/app-navigation";

type Store = { id: string; name: string; active: boolean };
type TeamUser = {
  id: string;
  username: string;
  active: boolean;
  clientRole: "OWNER" | "MEMBER" | null;
  stores: Store[];
};

export default function TeamPage() {
  const { t } = useT();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [addAsOwner, setAddAsOwner] = useState(false);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const meResponse = await fetch("/api/auth/me");
    const meData = await meResponse.json().catch(() => null);
    if (meData?.user?.id) setCurrentUserId(meData.user.id);

    const response = await fetch("/api/team/users");
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? t("errors.forbidden"));
      return;
    }
    setUsers(data.users ?? []);
    setStores(data.stores ?? []);
    const activeStoreIds = (data.stores as Store[] | undefined)
      ?.filter((store) => store.active)
      .map((store) => store.id);
    if (activeStoreIds?.length) {
      setStoreIds((current) => (current.length ? current : [activeStoreIds[0]]));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/team/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        storeIds,
        clientRole: addAsOwner ? "OWNER" : "MEMBER",
      }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.createFailed"));
      return;
    }
    setUsername("");
    setPassword("");
    setAddAsOwner(false);
    setMessage(t("team.created"));
    await load();
  }

  async function patchUser(
    userId: string,
    patch: { active?: boolean; clientRole?: "OWNER" | "MEMBER" },
  ) {
    setError("");
    setMessage("");
    const response = await fetch("/api/team/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(data?.error ?? t("team.saveFailed"));
      return;
    }
    if (patch.clientRole !== undefined) {
      setMessage(t("team.ownerUpdated"));
    }
    await load();
  }

  function toggleStore(id: string) {
    setStoreIds((current) =>
      current.includes(id)
        ? current.filter((storeId) => storeId !== id)
        : [...current, id],
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-lg space-y-4 px-4 py-3">
      <MobilePageHeader title={t("team.title")} />
      <p className="text-sm text-muted">{t("app.teamHint")}</p>

      {loading ? <p className="text-sm text-muted">{t("team.loading")}</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}
      {message ? <p className="text-sm text-success-fg">{message}</p> : null}

      <section className="space-y-2 rounded-2xl border border-card-border p-4">
        <h2 className="text-sm font-semibold text-foreground">{t("team.members")}</h2>
        {!loading && users.length === 0 ? (
          <p className="text-sm text-muted">{t("team.empty")}</p>
        ) : null}
        <ul className="space-y-2">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <li
                key={user.id}
                className="rounded-xl border border-card-border bg-card px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {user.username}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-muted">
                          ({t("team.you")})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {user.clientRole === "OWNER" ? t("team.owner") : t("team.member")}
                      {" · "}
                      {user.active ? t("team.active") : t("team.inactive")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {user.stores.map((store) => store.name).join(", ") || "—"}
                    </p>
                  </div>
                  {!isSelf ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      {user.clientRole === "MEMBER" ? (
                        <>
                          <SecondaryButton
                            onClick={() => void patchUser(user.id, { clientRole: "OWNER" })}
                          >
                            {t("team.makeOwner")}
                          </SecondaryButton>
                          <SecondaryButton
                            onClick={() => void patchUser(user.id, { active: !user.active })}
                          >
                            {user.active ? t("team.deactivate") : t("team.activate")}
                          </SecondaryButton>
                        </>
                      ) : (
                        <SecondaryButton
                          onClick={() => void patchUser(user.id, { clientRole: "MEMBER" })}
                        >
                          {t("team.removeOwner")}
                        </SecondaryButton>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-card-border p-4">
        <h2 className="text-sm font-semibold text-foreground">{t("team.addMember")}</h2>
        <label className="block text-sm font-medium text-foreground">
          {t("team.username")}
          <input
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          {t("team.password")}
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-foreground"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <div>
          <p className="text-sm font-medium text-foreground">{t("team.locations")}</p>
          <div className="mt-2 space-y-1">
            {stores.map((store) => (
              <label
                key={store.id}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={storeIds.includes(store.id)}
                  onChange={() => toggleStore(store.id)}
                  disabled={!store.active}
                />
                {store.name}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={addAsOwner}
            onChange={(event) => setAddAsOwner(event.target.checked)}
          />
          {t("team.addAsOwner")}
        </label>
        <PrimaryButton
          onClick={() => void createUser()}
          disabled={saving || !username.trim() || password.length < 6}
        >
          {t("team.create")}
        </PrimaryButton>
      </section>

      <SecondaryButton onClick={() => navigateApp("/app")}>
        {t("common.back")}
      </SecondaryButton>
    </div>
  );
}