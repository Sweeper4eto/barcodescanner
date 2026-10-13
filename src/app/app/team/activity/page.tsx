"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BackArrowIcon } from "@/components/app-nav-icons";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MenuSelect } from "@/components/menu-select";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";
import {
  extractAuditStoreName,
  formatAuditCompactWhen,
} from "@/lib/audit-display";
import {
  appButtonNeutral,
  appChromeInset,
  appListInset,
  appPageShell,
  appSearchInput,
} from "@/lib/app-ui";

type AuditEntry = {
  id: string;
  username: string;
  event: string;
  details: string;
  occurredAt: string;
};

type ActivityFilter = "all" | "auth" | "inventory" | "products";

type StoreOption = { id: string; name: string; active: boolean };

const PAGE_SIZES = [10, 20, 50] as const;
const ALL = "__all__";

function eventLabelKey(event: string): MessageKey {
  return `admin.auditEvents.${event}` as MessageKey;
}

function eventClass(event: string) {
  if (event === "login") return "bg-emerald-100 text-emerald-800";
  if (event === "logout") {
    return "border border-card-border bg-transparent text-muted";
  }
  if (event.startsWith("product_")) return "bg-sky-100 text-sky-800";
  if (event.startsWith("inventory_") || event.startsWith("buy_list_")) {
    return "bg-amber-100 text-amber-900";
  }
  if (event.startsWith("user_")) return "bg-violet-100 text-violet-800";
  return "bg-blue-100 text-blue-800";
}

export default function TeamActivityPage() {
  const { t } = useT();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [username, setUsername] = useState(ALL);
  const [storeName, setStoreName] = useState(ALL);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const usernameOptions = useMemo(
    () => [
      { value: ALL, label: t("team.activityAllUsers") },
      ...usernames.map((name) => ({ value: name, label: name })),
    ],
    [usernames, t],
  );

  const storeOptions = useMemo(
    () => [
      { value: ALL, label: t("team.activityAllStores") },
      ...stores.map((store) => ({
        value: store.name,
        label: store.active
          ? store.name
          : `${store.name} (${t("team.inactive")})`,
      })),
    ],
    [stores, t],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          filter,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (query) params.set("q", query);
        if (username !== ALL) params.set("username", username);
        if (storeName !== ALL) params.set("store", storeName);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(`/api/team/activity-log?${params}`, {
          signal,
          credentials: "same-origin",
        });
        if (response.status === 403 || response.status === 401) {
          setForbidden(true);
          setEntries([]);
          return;
        }
        const data = (await response.json()) as {
          entries?: AuditEntry[];
          total?: number;
          totalPages?: number;
          page?: number;
          error?: string;
          options?: { usernames?: string[]; stores?: StoreOption[] };
        };
        if (!response.ok) {
          throw new Error(data.error ?? t("team.activityLoadFailed"));
        }
        setForbidden(false);
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        if (data.options?.usernames) setUsernames(data.options.usernames);
        if (data.options?.stores) setStores(data.options.stores);
      } catch (loadError) {
        if (signal?.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("team.activityLoadFailed"),
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [filter, page, pageSize, query, username, storeName, dateFrom, dateTo, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function formatEvent(event: string) {
    const key = eventLabelKey(event);
    const translated = t(key);
    return translated === key ? event : translated;
  }

  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const backAction = (
    <Link
      href="/app/team"
      className={`${appButtonNeutral} !px-2.5 !py-2`}
      aria-label={t("team.activityBack")}
    >
      <BackArrowIcon className="size-4 shrink-0" />
    </Link>
  );

  if (forbidden) {
    return (
      <div className={`${appPageShell} ${appChromeInset} py-6`}>
        <MobilePageHeader title={t("team.activityTitle")} action={backAction} />
        <p className="mt-4 text-sm text-muted">{t("team.activityOwnersOnly")}</p>
      </div>
    );
  }

  return (
    <div className={`${appPageShell} flex min-h-0 flex-col pb-8`}>
      <div className={appChromeInset}>
        <MobilePageHeader title={t("team.activityTitle")} action={backAction} />
        <p className="mt-1 text-sm text-muted">{t("team.activitySubtitle")}</p>
      </div>

      <div className={`${appListInset} mt-3 space-y-3`}>
        <form className="space-y-2" onSubmit={onSearch}>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t("team.activitySearchPlaceholder")}
            inputClassName={appSearchInput}
          />
          <div className="grid grid-cols-2 gap-2">
            <MenuSelect
              label={t("admin.eventType")}
              value={filter}
              onChange={(value) => {
                setFilter(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: t("admin.auditFilters.all") },
                { value: "auth", label: t("admin.auditFilters.auth") },
                { value: "inventory", label: t("admin.auditFilters.inventory") },
                { value: "products", label: t("admin.auditFilters.products") },
              ]}
            />
            <MenuSelect
              label={t("admin.perPage")}
              value={String(pageSize)}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
              options={PAGE_SIZES.map((size) => ({
                value: String(size),
                label: String(size),
              }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MenuSelect
              label={t("admin.userLabel")}
              value={username}
              onChange={(value) => {
                setUsername(value);
                setPage(1);
              }}
              options={usernameOptions}
            />
            <MenuSelect
              label={t("team.activityStoreFilter")}
              value={storeName}
              onChange={(value) => {
                setStoreName(value);
                setPage(1);
              }}
              options={storeOptions}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              {t("admin.dateFrom")}
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                className={`${appSearchInput} mt-1 w-full`}
              />
            </label>
            <label className="block text-xs text-muted">
              {t("admin.dateTo")}
              <input
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                className={`${appSearchInput} mt-1 w-full`}
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl border border-primary px-3 py-2.5 text-sm font-semibold text-primary"
          >
            {t("common.search")}
          </button>
        </form>

        {error ? (
          <p className="rounded-xl border border-danger-border px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border border-card-border">
          {loading ? (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center p-6" />
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted">{t("team.activityEmpty")}</p>
          ) : (
            <ul className="divide-y divide-card-border">
              {entries.map((entry) => {
                const store = extractAuditStoreName(entry.details);
                const whoWhere = [entry.username, store]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={entry.id} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {whoWhere || "—"}
                        </p>
                        <time
                          className="mt-0.5 block tabular-nums text-xs text-muted"
                          dateTime={entry.occurredAt}
                        >
                          {formatAuditCompactWhen(entry.occurredAt)}
                        </time>
                      </div>
                      <span
                        className={`max-w-[48%] shrink-0 truncate rounded-full px-2 py-0.5 text-xs font-medium ${eventClass(entry.event)}`}
                        title={formatEvent(entry.event)}
                      >
                        {formatEvent(entry.event)}
                      </span>
                    </div>
                    {entry.details ? (
                      <p
                        className="mt-1.5 line-clamp-2 text-xs text-muted"
                        title={entry.details}
                      >
                        {entry.details}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {total === 0
              ? t("team.activityEmpty")
              : t("admin.showingEntries", { start, end, total })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
            >
              {t("admin.previous")}
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
            >
              {t("admin.next")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
