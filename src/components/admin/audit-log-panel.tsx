"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminField, adminInputClass, adminPaginationClass, adminSearchInputClass } from "@/components/admin/admin-ui";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";

type AuditEntry = {
  id: string;
  userId: string;
  username: string;
  event: string;
  ipAddress: string;
  deviceInfo: string;
  details: string;
  occurredAt: string;
};

type AuditFilter = "all" | "auth" | "inventory" | "products" | "admin";

const PAGE_SIZES = [10, 20, 50] as const;

function eventLabelKey(event: string): MessageKey {
  const key = `admin.auditEvents.${event}` as MessageKey;
  return key;
}

export function AuditLogPanel() {
  const { t } = useT();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const loadAuditLog = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        filter,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query) params.set("q", query);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (timeFrom) params.set("timeFrom", timeFrom);
      if (timeTo) params.set("timeTo", timeTo);

      const response = await fetch(`/api/admin/audit-log?${params}`, { signal });
      const text = await response.text();
      if (!text) {
        throw new Error(t("admin.failedLoadAuditLog"));
      }
      const data = JSON.parse(text) as {
        entries?: AuditEntry[];
        total?: number;
        totalPages?: number;
        page?: number;
        pageSize?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? t("admin.failedLoadAuditLog"));
      }
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(data.page ?? 1);
      if (data.pageSize && PAGE_SIZES.includes(data.pageSize as (typeof PAGE_SIZES)[number])) {
        setPageSize(data.pageSize);
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }
      setEntries([]);
      setTotal(0);
      setError(
        loadError instanceof Error ? loadError.message : t("admin.failedLoadAuditLog"),
      );
    } finally {
      setLoading(false);
    }
  }, [filter, page, pageSize, query, dateFrom, dateTo, timeFrom, timeTo, t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAuditLog(controller.signal);
    return () => controller.abort();
  }, [loadAuditLog]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function clearFilters() {
    setFilter("all");
    setSearch("");
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setTimeFrom("");
    setTimeTo("");
    setPage(1);
  }

  function formatDate(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  }

  function formatEvent(event: string) {
    const key = eventLabelKey(event);
    const translated = t(key);
    return translated === key ? event : translated;
  }

  function eventClass(event: string) {
    if (event === "login") return "bg-emerald-100 text-emerald-800";
    if (event === "logout") return "bg-zinc-100 text-zinc-700";
    if (event.startsWith("client_") || event.startsWith("store_") || event === "user_updated" || event === "payment_recorded") {
      return "bg-violet-100 text-violet-800";
    }
    if (event.startsWith("product_")) return "bg-sky-100 text-sky-800";
    if (event.startsWith("inventory_")) return "bg-amber-100 text-amber-900";
    return "bg-blue-100 text-blue-800";
  }

  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{t("admin.auditLog")}</h2>
        <p className="mt-1 text-sm text-muted">{t("admin.auditDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminField label={t("admin.eventType")}>
          <select
            className={adminInputClass}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as AuditFilter);
              setPage(1);
            }}
          >
            <option value="all">{t("admin.auditFilters.all")}</option>
            <option value="auth">{t("admin.auditFilters.auth")}</option>
            <option value="inventory">{t("admin.auditFilters.inventory")}</option>
            <option value="products">{t("admin.auditFilters.products")}</option>
            <option value="admin">{t("admin.auditFilters.admin")}</option>
          </select>
        </AdminField>
        <AdminField label={t("admin.perPage")}>
          <select
            className={adminInputClass}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label={t("admin.dateFrom")}>
          <input
            type="date"
            className={adminInputClass}
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.dateTo")}>
          <input
            type="date"
            className={adminInputClass}
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.timeFrom")}>
          <input
            type="time"
            className={adminInputClass}
            value={timeFrom}
            onChange={(event) => {
              setTimeFrom(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
        <AdminField label={t("admin.timeTo")}>
          <input
            type="time"
            className={adminInputClass}
            value={timeTo}
            onChange={(event) => {
              setTimeTo(event.target.value);
              setPage(1);
            }}
          />
        </AdminField>
      </div>

      <form className="flex min-w-0 flex-wrap gap-2" onSubmit={onSearch}>
        <input
          className={adminSearchInputClass}
          placeholder={t("admin.auditSearchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg"
        >
          {t("common.search")}
        </button>
        <button
          type="button"
          onClick={() => void clearFilters()}
          className="rounded-xl border border-input-border px-4 py-2.5 text-sm font-medium"
        >
          {t("admin.clearFilters")}
        </button>
        <button
          type="button"
          onClick={() => void loadAuditLog()}
          className="rounded-xl border border-input-border px-4 py-2.5 text-sm font-medium"
        >
          {t("admin.refresh")}
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-danger-border bg-danger/5 px-4 py-3 text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-card-border">
        {loading ? (
          <p className="p-6 text-sm text-muted">{t("admin.loadingAuditLog")}</p>
        ) : entries.length === 0 ? (
          <p className="p-6 text-sm text-muted">{t("admin.noAuditEntries")}</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-card-border bg-subtle/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{t("admin.auditWhen")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.eventType")}</th>
                <th className="px-4 py-3 font-medium">{t("admin.userLabel")}</th>
                <th className="px-4 py-3 font-medium">{t("common.additionalInfo")}</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">{t("admin.device")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-card-border last:border-0">
                  <td className="px-4 py-3 text-foreground">
                    <span className="whitespace-nowrap">{formatDate(entry.occurredAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${eventClass(entry.event)}`}
                    >
                      {formatEvent(entry.event)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.username}</td>
                  <td className="max-w-md px-4 py-3 text-muted" title={entry.details || undefined}>
                    {entry.details || "—"}
                  </td>
                  <td className="break-all px-4 py-3 text-muted">
                    {entry.ipAddress || "—"}
                  </td>
                  <td className="max-w-[10rem] px-4 py-3 text-muted">{entry.deviceInfo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={adminPaginationClass}>
        <p className="text-sm text-muted">
          {total === 0
            ? t("admin.noAuditEntries")
            : t("admin.showingEntries", { start, end, total })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            {t("admin.pageOf", { page: safePage, totalPages })}
          </p>
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
    </div>
  );
}
