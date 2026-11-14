"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityGenericCard,
  ActivityListCard,
} from "@/components/activity-list-card";
import { CancelButton } from "@/components/cancel-button";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MenuSelect } from "@/components/menu-select";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";
import {
  extractAuditStoreName,
  parseAuditGoodsDetails,
} from "@/lib/audit-display";
import { replaceApp } from "@/lib/app-navigation";
import {
  appButtonNeutral,
  appButtonPrimary,
  appButtonPrimaryFull,
  appChromeInset,
  appContentMaxW,
  appFooterButtonGrid,
  appListInset,
  appPageShell,
  appSearchInput,
} from "@/lib/app-ui";
import { useBrowserBackStack } from "@/lib/browser-back";

/** Compact page list: 1 … 4 5 6 … 12 */
function pageItems(current: number, total: number): Array<number | "gap"> {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current]);
  if (current - 1 > 1) set.add(current - 1);
  if (current + 1 < total) set.add(current + 1);
  if (current <= 3) {
    set.add(2);
    set.add(3);
    set.add(4);
  }
  if (current >= total - 2) {
    set.add(total - 1);
    set.add(total - 2);
    set.add(total - 3);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

type AuditEntry = {
  id: string;
  username: string;
  event: string;
  details: string;
  occurredAt: string;
  revertedAt?: string | null;
  revertible?: boolean;
  revertBlockedReason?: string | null;
};

type ActivityFilter = "all" | "auth" | "inventory" | "products";

type StoreOption = { id: string; name: string; active: boolean };

const PAGE_SIZES = [10, 20, 50] as const;
const ALL = "__all__";
const SELECTION_LIMIT = 50;

function eventLabelKey(event: string): MessageKey {
  return `admin.auditEvents.${event}` as MessageKey;
}

function eventClass(event: string) {
  if (event === "login") return "bg-emerald-100 text-emerald-800";
  if (event === "logout") {
    return "border border-card-border bg-transparent text-muted";
  }
  if (event.startsWith("product_")) return "bg-sky-100 text-sky-800";
  if (event === "activity_reverted") return "bg-slate-100 text-slate-800";
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
  const [revertTarget, setRevertTarget] = useState<AuditEntry | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [revertBusy, setRevertBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, true>>({});

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

  const selectedCount = Object.keys(selectedIds).length;
  const selectionAtLimit = selectedCount >= SELECTION_LIMIT;
  const revertibleOnPage = useMemo(
    () => entries.filter((entry) => entry.revertible === true),
    [entries],
  );

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds({});
    setBulkConfirmOpen(false);
  }

  useBrowserBackStack([
    {
      id: "bulk-confirm",
      open: bulkConfirmOpen,
      close: () => setBulkConfirmOpen(false),
    },
    {
      id: "single-revert",
      open: revertTarget !== null,
      close: () => {
        if (!revertBusy) setRevertTarget(null);
      },
    },
    {
      id: "selection",
      open: selectionMode,
      close: exitSelectionMode,
    },
  ]);

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

  useEffect(() => {
    setSelectedIds((current) => {
      const next: Record<string, true> = {};
      let changed = false;
      for (const id of Object.keys(current)) {
        const stillRevertible = entries.some(
          (entry) => entry.id === id && entry.revertible === true,
        );
        if (stillRevertible) next[id] = true;
        else changed = true;
      }
      if (!changed && Object.keys(next).length === Object.keys(current).length) {
        return current;
      }
      return next;
    });
  }, [entries]);

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

  function enterSelectionWith(entryId: string) {
    setSelectionMode(true);
    setSelectedIds({ [entryId]: true });
    setError("");
    setNotice("");
  }

  function toggleSelected(entryId: string) {
    if (selectedIds[entryId]) {
      setSelectedIds((current) => {
        const next = { ...current };
        delete next[entryId];
        return next;
      });
      return;
    }
    if (Object.keys(selectedIds).length >= SELECTION_LIMIT) {
      setError(t("team.activitySelectMax", { max: SELECTION_LIMIT }));
      return;
    }
    setSelectedIds((current) => ({ ...current, [entryId]: true }));
  }

  async function confirmSingleRevert() {
    if (!revertTarget) return;
    setRevertBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/team/activity-log/revert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditId: revertTarget.id }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? t("errors.revertFailed"));
      }
      setNotice(t("team.activityRevertDone"));
      setRevertTarget(null);
      await load();
    } catch (revertError) {
      setError(
        revertError instanceof Error
          ? revertError.message
          : t("errors.revertFailed"),
      );
      setRevertTarget(null);
    } finally {
      setRevertBusy(false);
    }
  }

  async function confirmBulkRevert() {
    const ids = Object.keys(selectedIds);
    if (ids.length === 0 || revertBusy) return;
    setRevertBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/team/activity-log/revert", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditIds: ids }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        reverted?: number;
        failed?: Array<{ error?: string }>;
      };
      if (!response.ok && data.reverted === undefined) {
        throw new Error(data.error ?? t("errors.revertFailed"));
      }
      const reverted = data.reverted ?? 0;
      const failedCount = data.failed?.length ?? 0;
      if (reverted > 0) {
        setNotice(
          failedCount > 0
            ? t("team.activityBulkRevertPartial", {
                reverted,
                failed: failedCount,
              })
            : t("team.activityBulkRevertDone", { count: reverted }),
        );
      } else {
        setError(
          data.failed?.[0]?.error ??
            data.error ??
            t("errors.revertFailed"),
        );
      }
      exitSelectionMode();
      await load();
    } catch (revertError) {
      setError(
        revertError instanceof Error
          ? revertError.message
          : t("errors.revertFailed"),
      );
      setBulkConfirmOpen(false);
    } finally {
      setRevertBusy(false);
    }
  }

  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  function handleActivityHeaderBack() {
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    replaceApp("/app/team");
  }

  if (forbidden) {
    return (
      <div className={`${appPageShell} ${appChromeInset} pb-8 pt-1`}>
        <MobilePageHeader
          title={t("team.activityTitle")}
          onBack={() => replaceApp("/app/team")}
        />
        <p className="mt-4 text-sm text-muted">{t("team.activityOwnersOnly")}</p>
      </div>
    );
  }

  const pages = pageItems(safePage, totalPages);

  return (
    <div
      className={`${appPageShell} flex min-h-0 flex-col pt-1 ${
        selectionMode ? "pb-24" : "pb-8"
      }`}
    >
      <div className={appChromeInset}>
        <MobilePageHeader
          title={
            selectionMode
              ? t("team.activitySelectedCount", { count: selectedCount })
              : t("team.activityTitle")
          }
          onBack={handleActivityHeaderBack}
        />
        {!selectionMode ? (
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {t("team.activitySubtitle")}
          </p>
        ) : (
          <p className="mt-0.5 text-xs leading-snug text-muted">
            {t("team.activitySelectHint")}
          </p>
        )}
      </div>

      <div className={`${appListInset} mt-1.5 space-y-1.5`}>
        {!selectionMode ? (
          <form className="space-y-1" onSubmit={onSearch}>
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={t("team.activitySearchPlaceholder")}
              inputClassName={appSearchInput}
            />
            <div className="grid grid-cols-2 gap-1">
              <MenuSelect
                size="compact"
                label={t("admin.eventType")}
                value={filter}
                onChange={(value) => {
                  setFilter(value);
                  setPage(1);
                }}
                options={[
                  { value: "all", label: t("admin.auditFilters.all") },
                  { value: "auth", label: t("admin.auditFilters.auth") },
                  {
                    value: "inventory",
                    label: t("admin.auditFilters.inventory"),
                  },
                  {
                    value: "products",
                    label: t("admin.auditFilters.products"),
                  },
                ]}
              />
              <MenuSelect
                size="compact"
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
            <div className="grid grid-cols-2 gap-1">
              <MenuSelect
                size="compact"
                label={t("admin.userLabel")}
                value={username}
                onChange={(value) => {
                  setUsername(value);
                  setPage(1);
                }}
                options={usernameOptions}
              />
              <MenuSelect
                size="compact"
                label={t("team.activityStoreFilter")}
                value={storeName}
                onChange={(value) => {
                  setStoreName(value);
                  setPage(1);
                }}
                options={storeOptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <label className="block text-[0.65rem] leading-tight text-muted">
                {t("admin.dateFrom")}
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  className="mt-0.5 h-8 w-full rounded-lg border border-input-border bg-input px-2 text-sm text-foreground"
                />
              </label>
              <label className="block text-[0.65rem] leading-tight text-muted">
                {t("admin.dateTo")}
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  className="mt-0.5 h-8 w-full rounded-lg border border-input-border bg-input px-2 text-sm text-foreground"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" className={appButtonPrimary}>
                {t("common.search")}
              </button>
              <button
                type="button"
                disabled={revertibleOnPage.length === 0}
                className={appButtonNeutral}
                onClick={() => {
                  const first = revertibleOnPage[0];
                  if (!first) return;
                  enterSelectionWith(first.id);
                }}
              >
                {t("team.activitySelect")}
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-danger-border px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-xl border border-card-border px-3 py-2 text-sm text-foreground">
            {notice}
          </p>
        ) : null}
        {!loading &&
        !selectionMode &&
        entries.length > 0 &&
        revertibleOnPage.length === 0 ? (
          <p className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted">
            {t("team.activityNoRevertible")}
          </p>
        ) : null}

        <div className="space-y-1.5">
          {loading ? (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center p-6" />
          ) : entries.length === 0 ? (
            <p className="rounded-xl bg-transparent p-4 text-sm text-muted">
              {t("team.activityEmpty")}
            </p>
          ) : (
            entries.map((entry) => {
              const storeName = extractAuditStoreName(entry.details);
              const goods = entry.details
                ? parseAuditGoodsDetails(entry.details)
                : null;
              const showRevert = entry.revertible === true;
              const showReverted = Boolean(entry.revertedAt);
              const selected = Boolean(selectedIds[entry.id]);
              const selectionDisabled =
                selectionMode &&
                (!showRevert || (selectionAtLimit && !selected));
              const eventLabel = formatEvent(entry.event);
              const eventClassName = eventClass(entry.event);

              if (goods?.isGoods) {
                return (
                  <ActivityListCard
                    key={entry.id}
                    name={
                      goods.title?.trim()
                        ? goods.title
                        : t("team.activityUntitledProduct")
                    }
                    username={entry.username}
                    storeName={storeName}
                    occurredAt={entry.occurredAt}
                    eventLabel={eventLabel}
                    eventClassName={eventClassName}
                    quantity={goods.quantity}
                    quantityText={goods.quantityText}
                    expiryYmd={goods.expiryYmd}
                    expiryText={goods.expiryText}
                    discount={goods.discount}
                    detail={goods.fallback}
                    selectionMode={selectionMode}
                    selected={selected}
                    selectionDisabled={selectionDisabled}
                    showRevert={showRevert}
                    showReverted={showReverted}
                    onLongPressSelect={() => enterSelectionWith(entry.id)}
                    onToggleSelected={() => toggleSelected(entry.id)}
                    onRevert={() => {
                      setError("");
                      setNotice("");
                      setRevertTarget(entry);
                    }}
                  />
                );
              }

              return (
                <ActivityGenericCard
                  key={entry.id}
                  username={entry.username}
                  storeName={storeName}
                  occurredAt={entry.occurredAt}
                  eventLabel={eventLabel}
                  eventClassName={eventClassName}
                  detail={goods?.fallback ?? entry.details ?? null}
                />
              );
            })
          )}
        </div>

        {!selectionMode ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted">
              {total === 0
                ? t("team.activityEmpty")
                : t("admin.showingEntries", { start, end, total })}
            </p>
            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {pages.map((item, index) =>
                  item === "gap" ? (
                    <span
                      key={`gap-${index}`}
                      className="px-1 text-sm text-muted"
                      aria-hidden
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      aria-current={item === safePage ? "page" : undefined}
                      onClick={() => setPage(item)}
                      className={`min-w-8 rounded-lg border px-2.5 py-1.5 text-sm font-semibold tabular-nums ${
                        item === safePage
                          ? "border-primary text-primary"
                          : "border-card-border text-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectionMode ? (
        <div
          className={`fixed inset-x-0 z-50 mx-auto w-full ${appContentMaxW} border-t border-card-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90`}
          style={{
            bottom:
              "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className={appFooterButtonGrid}>
            <CancelButton
              onClick={exitSelectionMode}
              disabled={revertBusy}
            >
              {t("common.cancel")}
            </CancelButton>
            <button
              type="button"
              className={appButtonPrimaryFull}
              disabled={selectedCount === 0 || revertBusy}
              onClick={() => setBulkConfirmOpen(true)}
            >
              {revertBusy
                ? t("team.activityBulkReverting")
                : t("team.activityBulkRevert", { count: selectedCount })}
            </button>
          </div>
        </div>
      ) : null}

      {revertTarget ? (
        <RemoveConfirmDialog
          title={t("team.activityRevertTitle")}
          message={t("team.activityRevertMessage")}
          itemLabel={formatEvent(revertTarget.event)}
          cancelLabel={t("common.cancel")}
          removeLabel={t("team.activityRevertConfirm")}
          busy={revertBusy}
          onCancel={() => {
            if (!revertBusy) setRevertTarget(null);
          }}
          onConfirm={() => {
            void confirmSingleRevert();
          }}
        />
      ) : null}

      {bulkConfirmOpen ? (
        <RemoveConfirmDialog
          title={t("team.activityBulkRevertTitle")}
          message={t("team.activityBulkRevertMessage")}
          itemLabel={t("team.activityBulkRevertItems", {
            count: selectedCount,
          })}
          cancelLabel={t("common.cancel")}
          removeLabel={t("team.activityBulkRevert", { count: selectedCount })}
          busy={revertBusy}
          onCancel={() => {
            if (!revertBusy) setBulkConfirmOpen(false);
          }}
          onConfirm={() => {
            void confirmBulkRevert();
          }}
        />
      ) : null}
    </div>
  );
}
