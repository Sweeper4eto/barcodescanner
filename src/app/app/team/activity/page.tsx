"use client";

import Link from "next/link";
import {
  FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackArrowIcon } from "@/components/app-nav-icons";
import { LoadingSpinnerBlock } from "@/components/loading-spinner";
import { MenuSelect } from "@/components/menu-select";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { RemoveConfirmDialog } from "@/components/remove-confirm-dialog";
import { SearchField } from "@/components/search-field";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";
import {
  extractAuditStoreName,
  formatAuditCompactWhen,
} from "@/lib/audit-display";
import {
  appButtonNeutral,
  appButtonPrimary,
  appButtonPrimaryFull,
  appChromeInset,
  appFooterButtonGrid,
  appListInset,
  appPageShell,
  appSearchInput,
} from "@/lib/app-ui";
import { useBrowserBackStack } from "@/lib/browser-back";

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
const LONG_PRESS_MS = 450;
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

  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleRowPointerDown(entry: AuditEntry, event: ReactPointerEvent) {
    if (selectionMode || entry.revertible !== true) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    longPressTriggered.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      longPressTimer.current = null;
      window.getSelection()?.removeAllRanges();
      enterSelectionWith(entry.id);
    }, LONG_PRESS_MS);
  }

  function handleRowPointerMove(event: ReactPointerEvent) {
    if (!pointerStart.current || longPressTimer.current === null) return;
    const dx = Math.abs(event.clientX - pointerStart.current.x);
    const dy = Math.abs(event.clientY - pointerStart.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }

  function handleRowPointerEnd() {
    clearLongPress();
    pointerStart.current = null;
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

  const backAction = selectionMode ? (
    <button
      type="button"
      className={`${appButtonNeutral} !px-2.5 !py-2 text-xs`}
      onClick={exitSelectionMode}
    >
      {t("common.cancel")}
    </button>
  ) : (
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
    <div
      className={`${appPageShell} flex min-h-0 flex-col ${
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
          action={backAction}
        />
        {!selectionMode ? (
          <p className="mt-1 text-sm text-muted">{t("team.activitySubtitle")}</p>
        ) : (
          <p className="mt-1 text-sm text-muted">
            {t("team.activitySelectHint")}
          </p>
        )}
      </div>

      <div className={`${appListInset} mt-3 space-y-3`}>
        {!selectionMode ? (
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="rounded-xl border border-primary px-3 py-2.5 text-sm font-semibold text-primary"
              >
                {t("common.search")}
              </button>
              <button
                type="button"
                disabled={revertibleOnPage.length === 0}
                className={`${appButtonNeutral} disabled:opacity-40`}
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

        <div className="rounded-xl border border-card-border">
          {loading ? (
            <LoadingSpinnerBlock wrapperClassName="flex justify-center p-6" />
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted">{t("team.activityEmpty")}</p>
          ) : (
            <ul className="divide-y divide-card-border select-none [-webkit-touch-callout:none]">
              {entries.map((entry) => {
                const store = extractAuditStoreName(entry.details);
                const whoWhere = [entry.username, store]
                  .filter(Boolean)
                  .join(" · ");
                const showRevert = entry.revertible === true;
                const showReverted = Boolean(entry.revertedAt);
                const selected = Boolean(selectedIds[entry.id]);
                const selectionDisabled =
                  selectionMode &&
                  (!showRevert || (selectionAtLimit && !selected));

                return (
                  <li
                    key={entry.id}
                    className={`px-3 py-2.5 transition-colors ${
                      selected ? "bg-selected" : ""
                    } ${selectionDisabled ? "opacity-45" : ""} ${
                      selectionMode && showRevert ? "cursor-pointer" : ""
                    }`}
                    aria-pressed={selectionMode ? selected : undefined}
                    onClick={() => {
                      if (!selectionMode) return;
                      if (longPressTriggered.current) {
                        longPressTriggered.current = false;
                        return;
                      }
                      if (!showRevert || selectionDisabled) return;
                      toggleSelected(entry.id);
                    }}
                    onPointerDown={(event) =>
                      handleRowPointerDown(entry, event)
                    }
                    onPointerMove={handleRowPointerMove}
                    onPointerUp={handleRowPointerEnd}
                    onPointerCancel={handleRowPointerEnd}
                    onPointerLeave={handleRowPointerEnd}
                    onContextMenu={(event) => {
                      if (showRevert) event.preventDefault();
                    }}
                  >
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
                      <div className="flex max-w-[55%] shrink-0 items-center gap-2">
                        {selectionMode && showRevert ? (
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold ${
                              selected
                                ? "border-primary bg-selected text-primary"
                                : "border-card-border text-transparent"
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                        ) : null}
                        <span
                          className={`truncate rounded-full px-2 py-0.5 text-xs font-medium ${eventClass(entry.event)}`}
                          title={formatEvent(entry.event)}
                        >
                          {formatEvent(entry.event)}
                        </span>
                      </div>
                    </div>
                    {entry.details ? (
                      <p
                        className="mt-1.5 line-clamp-2 text-xs text-muted"
                        title={entry.details}
                      >
                        {entry.details}
                      </p>
                    ) : null}
                    {!selectionMode && (showRevert || showReverted) ? (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {showReverted ? (
                          <span className="text-xs font-medium text-muted">
                            {t("team.activityAlreadyReverted")}
                          </span>
                        ) : null}
                        {showRevert ? (
                          <button
                            type="button"
                            className={`${appButtonPrimary} !px-2.5 !py-1.5 text-xs`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setError("");
                              setNotice("");
                              setRevertTarget(entry);
                            }}
                          >
                            {t("team.activityRevert")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!selectionMode ? (
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
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                className="rounded-xl border border-card-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
              >
                {t("admin.next")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selectionMode ? (
        <div
          className="fixed inset-x-0 z-50 mx-auto w-full max-w-lg border-t border-card-border bg-background/95 px-3 pb-2 pt-2 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90"
          style={{
            bottom:
              "calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className={appFooterButtonGrid}>
            <button
              type="button"
              className={appButtonNeutral}
              onClick={exitSelectionMode}
              disabled={revertBusy}
            >
              {t("common.cancel")}
            </button>
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
