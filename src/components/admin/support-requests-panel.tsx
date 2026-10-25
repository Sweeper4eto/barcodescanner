"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/auth-forms";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { useT } from "@/components/i18n-provider";
import { formatSupportTicketNumber } from "@/lib/support-ticket";

type SupportStatus = "new" | "in_progress" | "done";

type SupportRow = {
  id: string;
  topic: string;
  status: SupportStatus;
  contact: string | null;
  message: string;
  documentImagePath: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  username: string;
  storeName: string | null;
  clientName: string | null;
  ownerName: string | null;
};

export function SupportRequestsPanel({
  onCounts,
}: {
  onCounts?: (counts: { new: number; in_progress: number; done: number }) => void;
}) {
  const { t, dateLocale } = useT();
  const [rows, setRows] = useState<SupportRow[]>([]);
  const [status, setStatus] = useState<SupportStatus | "all">("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, done: 0 });
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const topicLabel = useCallback(
    (topic: string, short = false) => {
      if (topic === "ocr") {
        return short ? t("support.topicOcrShort") : t("support.topicOcr");
      }
      if (topic === "ocr_expiry_alert") {
        return short
          ? t("support.topicOcrExpiryAlertShort")
          : t("support.topicOcrExpiryAlert");
      }
      if (topic === "billing") {
        return short ? t("support.topicBillingShort") : t("support.topicBilling");
      }
      if (topic === "other") {
        return short ? t("support.topicOtherShort") : t("support.topicOther");
      }
      return short ? t("support.topicBugShort") : t("support.topicBug");
    },
    [t],
  );

  const statusLabel = useCallback(
    (value: SupportStatus) => {
      if (value === "in_progress") return t("support.statusInProgress");
      if (value === "done") return t("support.statusDone");
      return t("support.statusNew");
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const response = await fetch(`/api/admin/support/requests${query}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      const loadedCounts = data?.counts ?? { new: 0, in_progress: 0, done: 0 };
      setCounts(loadedCounts);
      onCounts?.(loadedCounts);
      const loaded = (data?.requests ?? []) as SupportRow[];
      setRows(loaded);
      setSelected((current) => {
        const next: Record<string, boolean> = {};
        for (const row of loaded) {
          if (current[row.id]) next[row.id] = true;
        }
        return next;
      });
      setNoteDraft((current) => {
        const next = { ...current };
        for (const row of loaded) {
          if (!(row.id in next)) next[row.id] = row.adminNote ?? "";
        }
        return next;
      });
    } catch {
      setError(t("errors.networkError"));
    } finally {
      setLoading(false);
    }
  }, [onCounts, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedIds = useMemo(
    () => rows.filter((row) => selected[row.id]).map((row) => row.id),
    [rows, selected],
  );
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of rows) next[row.id] = true;
    setSelected(next);
  }

  async function patchRow(
    id: string,
    patch: { status?: SupportStatus; adminNote?: string; deleteDocument?: true },
  ) {
    setSavingId(id);
    setError("");
    try {
      const response = await fetch("/api/admin/support/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      await load();
    } finally {
      setSavingId("");
    }
  }

  async function bulkStatus(nextStatus: SupportStatus) {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, status: nextStatus }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setSelected({});
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        t("support.confirmDeleteTickets", { count: selectedIds.length }),
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support/requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? t("errors.saveFailed"));
        return;
      }
      setSelected({});
      setOpenId((current) =>
        current && selectedIds.includes(current) ? null : current,
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(
    () =>
      `${t("support.statusNew")}: ${counts.new} · ${t("support.statusInProgress")}: ${counts.in_progress} · ${t("support.statusDone")}: ${counts.done}`,
    [counts.done, counts.in_progress, counts.new, t],
  );

  const busy = saving || Boolean(savingId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("support.inboxTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{summary}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          onClick={() => setStatus("new")}
          disabled={status === "new"}
        >
          {t("support.statusNew")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("in_progress")}
          disabled={status === "in_progress"}
        >
          {t("support.statusInProgress")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("done")}
          disabled={status === "done"}
        >
          {t("support.statusDone")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => setStatus("all")}
          disabled={status === "all"}
        >
          {t("admin.auditFilters.all")}
        </SecondaryButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-muted">
          {t("support.selectedCount", { count: selectedIds.length })}
        </p>
        <SecondaryButton
          onClick={() => void bulkStatus("new")}
          disabled={busy || selectedIds.length === 0}
        >
          {t("support.markNew")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => void bulkStatus("in_progress")}
          disabled={busy || selectedIds.length === 0}
        >
          {t("support.markInProgress")}
        </SecondaryButton>
        <SecondaryButton
          onClick={() => void bulkStatus("done")}
          disabled={busy || selectedIds.length === 0}
        >
          {t("support.markDone")}
        </SecondaryButton>
        <button
          type="button"
          disabled={busy || selectedIds.length === 0}
          onClick={() => void bulkDelete()}
          className="rounded-xl border border-danger bg-transparent px-3 py-2.5 text-sm font-semibold text-danger disabled:opacity-50"
        >
          {t("support.deleteTickets")}
        </button>
      </div>

      {loading ? (
        <LoadingSpinnerBlock wrapperClassName="flex justify-center py-4" />
      ) : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-muted">{t("support.emptyInbox")}</p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-card-border">
          <div className="flex items-center gap-2 border-b border-card-border px-3 py-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              aria-label={t("support.selectAll")}
            />
            <span>{t("support.selectAll")}</span>
          </div>
          {rows.map((row) => {
            const ticket = formatSupportTicketNumber(row.id);
            const owner = row.ownerName || row.clientName || "—";
            const actor = row.username;
            const open = openId === row.id;
            return (
              <article
                key={row.id}
                className="border-b border-card-border/70 last:border-0"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.id])}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [row.id]: event.target.checked,
                      }))
                    }
                    aria-label={t("support.selectTicket", { ticket })}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-foreground"
                    onClick={() =>
                      setOpenId((current) => (current === row.id ? null : row.id))
                    }
                  >
                    <span className="font-semibold">{owner}</span>
                    <span className="text-muted"> / </span>
                    <span>{actor}</span>
                    <span className="ml-2 font-mono text-xs text-muted">{ticket}</span>
                  </button>
                </div>
                {open ? (
                  <div className="space-y-3 px-3 pb-3 pl-9">
                    <p className="text-xs text-muted">
                      {topicLabel(row.topic)} · {statusLabel(row.status)}
                      {row.storeName ? ` · ${row.storeName}` : ""}
                      {` · ${new Date(row.createdAt).toLocaleString(dateLocale)}`}
                    </p>
                    {row.contact ? (
                      <p className="text-xs text-muted">
                        {t("support.contact")}: {row.contact}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {row.message}
                    </p>
                    {row.documentImagePath ? (
                      <div className="space-y-2">
                        <a
                          href={row.documentImagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-fit"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- private /uploads route needs the session cookie */}
                          <img
                            src={row.documentImagePath}
                            alt={t("support.documentCopy")}
                            className="max-h-48 rounded-lg border border-card-border object-contain"
                          />
                        </a>
                        <SecondaryButton
                          onClick={() => {
                            if (!window.confirm(t("support.confirmDeleteDocument"))) {
                              return;
                            }
                            void patchRow(row.id, { deleteDocument: true });
                          }}
                          disabled={busy}
                        >
                          {t("support.deleteDocument")}
                        </SecondaryButton>
                      </div>
                    ) : null}
                    <label className="block text-xs font-medium text-muted">
                      {t("support.adminNote")}
                      <textarea
                        className="mt-1 min-h-16 w-full rounded-xl border border-input-border bg-input px-3 py-2 text-sm text-foreground"
                        value={noteDraft[row.id] ?? ""}
                        onChange={(event) =>
                          setNoteDraft((current) => ({
                            ...current,
                            [row.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <PrimaryButton
                      onClick={() =>
                        void patchRow(row.id, {
                          adminNote: noteDraft[row.id] ?? "",
                        })
                      }
                      disabled={busy}
                    >
                      {t("common.save")}
                    </PrimaryButton>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
