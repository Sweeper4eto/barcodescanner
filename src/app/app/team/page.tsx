"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrimaryButton } from "@/components/auth-forms";
import { CancelButton } from "@/components/cancel-button";
import { LoadingSpinner, LoadingSpinnerBlock } from "@/components/loading-spinner";
import { appButtonDangerFull, appButtonPrimaryFull } from "@/lib/app-ui";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { MenuSelect } from "@/components/menu-select";
import { useT } from "@/components/i18n-provider";

type Store = { id: string; name: string; active: boolean };
type TeamUser = {
  id: string;
  username: string;
  email: string | null;
  active: boolean;
  clientRole: "OWNER" | "MEMBER" | null;
  stores: Store[];
};

function initials(username: string): string {
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

function EyeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2" strokeLinecap="round" />
      <path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-4.2 4.8M6.1 6.1A18 18 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 4-.7" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" strokeLinejoin="round" />
      <path d="M9 7V4h6v3" strokeLinejoin="round" />
    </svg>
  );
}

/** Crown — owner */
function OwnerRoleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 8l4 3 5-6 5 6 4-3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" strokeLinejoin="round" />
      <path d="M8 19h8" strokeLinecap="round" />
    </svg>
  );
}

/** Person — staff */
function StaffRoleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
    </svg>
  );
}

export default function TeamPage() {
  const { t } = useT();
  const usernameRef = useRef<HTMLInputElement>(null);

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<"OWNER" | "MEMBER">("MEMBER");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [storeSearch, setStoreSearch] = useState("");
  const [storesOpen, setStoresOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editStoreIds, setEditStoreIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TeamUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeStores = useMemo(
    () => stores.filter((store) => store.active),
    [stores],
  );

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return activeStores;
    return activeStores.filter((store) => store.name.toLowerCase().includes(q));
  }, [activeStores, storeSearch]);

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
      setStoreIds((current) => (current.length ? current : [activeStoreIds[0]!]));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function storesLabel(userStores: Store[]): string {
    if (activeStores.length > 0 && userStores.length >= activeStores.length) {
      return t("team.allStores");
    }
    if (userStores.length === 1) return t("team.storeCountOne");
    if (userStores.length === 0) return "—";
    return t("team.storeCount", { count: String(userStores.length) });
  }

  function storesTriggerLabel(): string {
    if (storeIds.length === 0) return t("team.storesPlaceholder");
    if (activeStores.length > 0 && storeIds.length >= activeStores.length) {
      return t("team.allStores");
    }
    if (storeIds.length === 1) return t("team.storeCountOne");
    return t("team.storeCount", { count: String(storeIds.length) });
  }

  function openEdit(user: TeamUser) {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditPassword("");
    setEditConfirmPassword("");
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
    setEditStoreIds(user.stores.map((store) => store.id));
    setError("");
    setMessage("");
  }

  function closeEdit() {
    setEditingUserId(null);
    setEditUsername("");
    setEditPassword("");
    setEditConfirmPassword("");
    setEditStoreIds([]);
  }

  async function createUser() {
    setSaving(true);
    setMessage("");
    setError("");
    if (password !== confirmPassword) {
      setSaving(false);
      setError(t("auth.passwordMismatch"));
      return;
    }
    const response = await fetch("/api/team/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        storeIds,
        clientRole: role,
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
    setConfirmPassword("");
    setRole("MEMBER");
    setMessage(t("team.created"));
    await load();
  }

  async function saveEdit() {
    if (!editingUserId) return;
    setEditSaving(true);
    setError("");
    setMessage("");
    if (editPassword || editConfirmPassword) {
      if (editPassword !== editConfirmPassword) {
        setEditSaving(false);
        setError(t("auth.passwordMismatch"));
        return;
      }
      if (editPassword.length < 6) {
        setEditSaving(false);
        setError(t("auth.passwordTooShort"));
        return;
      }
    }
    const response = await fetch("/api/team/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: editingUserId,
        username: editUsername,
        storeIds: editStoreIds,
        ...(editPassword
          ? { password: editPassword, confirmPassword: editConfirmPassword }
          : {}),
      }),
    });
    const data = await response.json().catch(() => null);
    setEditSaving(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.saveFailed"));
      return;
    }
    setMessage(t("team.updated"));
    closeEdit();
    await load();
  }

  function toggleStore(id: string) {
    setStoreIds((current) =>
      current.includes(id)
        ? current.filter((storeId) => storeId !== id)
        : [...current, id],
    );
  }

  function toggleEditStore(id: string) {
    setEditStoreIds((current) =>
      current.includes(id)
        ? current.filter((storeId) => storeId !== id)
        : [...current, id],
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/team/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deleteTarget.id }),
    });
    const data = await response.json().catch(() => null);
    setDeleting(false);
    if (!response.ok) {
      setError(data?.error ?? t("team.deleteFailed"));
      setDeleteTarget(null);
      return;
    }
    setMessage(t("team.deleted"));
    if (editingUserId === deleteTarget.id) closeEdit();
    setDeleteTarget(null);
    await load();
  }

  return (
    <div className="relative mx-auto min-w-0 max-w-lg overflow-x-visible px-4 pb-4 pt-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_70%_0%,rgb(52_211_153/0.14),transparent_55%)]"
      />

      <div className="relative z-40">
        <MobilePageHeader className="mb-3" />
      </div>

      <div className="relative z-0 mb-4">
        <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-foreground">
          {t("team.title")}
        </h1>
        <p className="mt-1 text-sm leading-snug text-muted">{t("team.subtitle")}</p>
      </div>

      {loading ? (
        <LoadingSpinnerBlock wrapperClassName="mb-3 flex justify-center py-2" />
      ) : null}
      {error ? <p className="mb-3 text-sm text-error">{error}</p> : null}
      {message ? <p className="mb-3 text-sm text-success-fg">{message}</p> : null}

      <section className="relative z-0 mb-4 overflow-hidden rounded-2xl border border-card-border bg-transparent">
        {!loading && users.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">{t("team.empty")}</p>
        ) : null}

        <ul className="divide-y divide-card-border">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isOwner = user.clientRole === "OWNER";
            const editing = editingUserId === user.id;

            return (
              <li key={user.id} className={`px-3 py-3 ${user.active ? "" : "opacity-55"}`}>
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/45 bg-selected text-xs font-semibold text-primary"
                  >
                    {initials(user.username)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user.username}
                      {isSelf ? (
                        <span className="ml-1.5 text-xs font-normal text-muted">
                          ({t("team.you")})
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">{user.email || "—"}</p>
                  </div>

                  <span
                    title={isOwner ? t("team.owner") : t("team.member")}
                    aria-label={isOwner ? t("team.owner") : t("team.member")}
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                      isOwner
                        ? "border-primary/50 bg-selected text-primary"
                        : "border-card-border text-muted"
                    }`}
                  >
                    {isOwner ? <OwnerRoleIcon /> : <StaffRoleIcon />}
                  </span>

                  <span className="hidden max-w-[5.5rem] truncate text-xs text-muted xs:inline sm:max-w-none sm:text-sm">
                    {storesLabel(user.stores)}
                  </span>

                  {!isSelf ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={t("team.editUser")}
                        aria-expanded={editing}
                        onClick={() => (editing ? closeEdit() : openEdit(user))}
                        className={`inline-flex size-8 items-center justify-center rounded-lg border transition-colors ${
                          editing
                            ? "border-primary bg-selected text-primary"
                            : "border-card-border text-foreground hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        aria-label={t("team.deleteUser")}
                        onClick={() => setDeleteTarget(user)}
                        className="inline-flex size-8 items-center justify-center rounded-lg border border-card-border text-foreground hover:border-danger/50 hover:text-danger"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ) : null}
                </div>

                <p className="mt-1.5 text-xs text-muted sm:hidden">{storesLabel(user.stores)}</p>

                {editing ? (
                  <div
                    className="mt-3 space-y-3 rounded-xl border border-card-border bg-background/70 p-3"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <label className="block text-sm font-medium text-foreground">
                      {t("team.username")}
                      <input
                        className="mt-1 w-full rounded-xl border border-input-border bg-transparent px-3 py-2 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
                        value={editUsername}
                        onChange={(event) => setEditUsername(event.target.value)}
                        autoComplete="off"
                      />
                    </label>

                    <label className="block text-sm font-medium text-foreground">
                      {t("team.newPassword")}
                      <span className="relative mt-1 block">
                        <input
                          type={showEditPassword ? "text" : "password"}
                          className="w-full rounded-xl border border-input-border bg-transparent py-2 pl-3 pr-11 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
                          value={editPassword}
                          placeholder={t("team.newPasswordPlaceholder")}
                          onChange={(event) => setEditPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
                          aria-label={
                            showEditPassword ? t("team.hidePassword") : t("team.showPassword")
                          }
                          onClick={() => setShowEditPassword((current) => !current)}
                        >
                          {showEditPassword ? <EyeIcon /> : <EyeOffIcon />}
                        </button>
                      </span>
                    </label>

                    <label className="block text-sm font-medium text-foreground">
                      {t("team.confirmPassword")}
                      <span className="relative mt-1 block">
                        <input
                          type={showEditConfirmPassword ? "text" : "password"}
                          className="w-full rounded-xl border border-input-border bg-transparent py-2 pl-3 pr-11 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
                          value={editConfirmPassword}
                          placeholder={t("team.confirmPasswordPlaceholder")}
                          onChange={(event) => setEditConfirmPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
                          aria-label={
                            showEditConfirmPassword
                              ? t("team.hidePassword")
                              : t("team.showPassword")
                          }
                          onClick={() => setShowEditConfirmPassword((current) => !current)}
                        >
                          {showEditConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
                        </button>
                      </span>
                    </label>

                    <div>
                      <p className="mb-1.5 text-sm font-medium text-foreground">{t("team.stores")}</p>
                      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-card-border p-2">
                        {activeStores.map((store) => (
                          <label
                            key={store.id}
                            className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-foreground hover:bg-selected/40"
                          >
                            <input
                              type="checkbox"
                              checked={editStoreIds.includes(store.id)}
                              onChange={() => toggleEditStore(store.id)}
                            />
                            {store.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={
                          editSaving ||
                          editUsername.trim().length < 3 ||
                          editStoreIds.length === 0
                        }
                        className={`min-w-0 flex-1 ${appButtonPrimaryFull}`}
                      >
                        {editSaving ? (
                          <LoadingSpinner size="sm" className="mx-auto" />
                        ) : (
                          t("team.saveChanges")
                        )}
                      </button>
                      <CancelButton
                        fullWidth={false}
                        className="min-w-0 flex-1 px-3 py-1.5"
                        onClick={closeEdit}
                      >
                        {t("team.cancelEdit")}
                      </CancelButton>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="relative z-0 space-y-3 rounded-2xl border border-card-border bg-transparent p-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("team.addMember")}</h2>
          <p className="mt-0.5 text-xs text-muted">{t("team.addMemberHint")}</p>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            {t("team.username")}
            <input
              ref={usernameRef}
              className="mt-1 w-full rounded-xl border border-input-border bg-transparent px-3 py-2 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
              value={username}
              placeholder={t("team.usernamePlaceholder")}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            {t("team.password")}
            <span className="relative mt-1 block">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-input-border bg-transparent py-2 pl-3 pr-11 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
                value={password}
                placeholder={t("team.passwordPlaceholder")}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
                aria-label={showPassword ? t("team.hidePassword") : t("team.showPassword")}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </span>
          </label>
        </div>

        <label className="block text-sm font-medium text-foreground">
          {t("team.confirmPassword")}
          <span className="relative mt-1 block">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full rounded-xl border border-input-border bg-transparent py-2 pl-3 pr-11 text-base text-foreground outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary/40"
              value={confirmPassword}
              placeholder={t("team.confirmPasswordPlaceholder")}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
              aria-label={
                showConfirmPassword ? t("team.hidePassword") : t("team.showPassword")
              }
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </span>
        </label>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">{t("team.role")}</p>
            <MenuSelect
              label={t("team.role")}
              value={role}
              options={[
                { value: "MEMBER", label: t("team.member") },
                { value: "OWNER", label: t("team.owner") },
              ]}
              onChange={setRole}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-foreground">{t("team.stores")}</p>
            <button
              type="button"
              onClick={() => setStoresOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-input-border bg-transparent px-3 py-2 text-left text-base text-foreground"
            >
              <span className={storeIds.length ? "text-foreground" : "text-muted"}>
                {storesTriggerLabel()}
              </span>
              <span className="text-[0.65rem] text-muted" aria-hidden>
                {storesOpen ? "▲" : "▼"}
              </span>
            </button>
          </div>
        </div>

        {storesOpen ? (
          <div className="rounded-xl border border-card-border p-2.5">
            <p className="mb-2 text-xs font-medium text-muted">{t("team.searchStores")}</p>
            <input
              className="mb-2 w-full rounded-lg border border-input-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
              value={storeSearch}
              onChange={(event) => setStoreSearch(event.target.value)}
              placeholder={t("team.searchStores")}
            />
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {filteredStores.map((store) => (
                <label
                  key={store.id}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm text-foreground hover:bg-selected/40"
                >
                  <input
                    type="checkbox"
                    checked={storeIds.includes(store.id)}
                    onChange={() => toggleStore(store.id)}
                  />
                  {store.name}
                </label>
              ))}
              {filteredStores.length === 0 ? (
                <p className="px-1.5 py-1 text-xs text-muted">{t("support.noStores")}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pt-1">
          <PrimaryButton
            onClick={() => void createUser()}
            disabled={
              saving ||
              !username.trim() ||
              password.length < 6 ||
              password !== confirmPassword ||
              storeIds.length === 0
            }
          >
            {saving ? (
              <LoadingSpinner size="sm" className="mx-auto" />
            ) : (
              t("team.create")
            )}
          </PrimaryButton>
        </div>
      </section>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-delete-title"
          onClick={() => (!deleting ? setDeleteTarget(null) : undefined)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-card-border bg-background p-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger">
              <TrashIcon className="size-5" />
            </div>
            <h2
              id="team-delete-title"
              className="text-lg font-semibold text-foreground"
            >
              {t("team.confirmDeleteTitle")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t("team.confirmDeleteMessage", { username: deleteTarget.username })}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className={appButtonDangerFull}
              >
                {deleting ? (
                  <LoadingSpinner size="sm" className="mx-auto" />
                ) : (
                  t("team.confirmDelete")
                )}
              </button>
              <CancelButton disabled={deleting} onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </CancelButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
