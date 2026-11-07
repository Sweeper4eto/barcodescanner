"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChartPanel,
  CompareBars,
  CoverageStrip,
  DayBars,
  KpiTile,
  RankBars,
  SegmentTabs,
} from "@/components/analytics-charts";
import { useAppSession } from "@/components/app-session-provider";
import { LoadingSpinnerPage } from "@/components/loading-spinner";
import { MobilePageHeader } from "@/components/mobile-page-header";
import { useT } from "@/components/i18n-provider";
import { useAppStoreId } from "@/hooks/use-app-store-id";
import { replaceApp } from "@/lib/app-navigation";
import {
  appButtonNeutral,
  appChromeInset,
  appListInset,
  appPageShell,
} from "@/lib/app-ui";
import type {
  OwnerAnalyticsReport,
  TopWasteProduct,
} from "@/lib/owner-analytics-query";

type StaffTab = "adds" | "removes" | "markdowns";
type AnalyticsLayout = "panels" | "focus" | "compact";

const LAYOUT_STORAGE_KEY = "expire365.analyticsLayout.v1";
const LAYOUTS: AnalyticsLayout[] = ["panels", "focus", "compact"];

function readLayout(): AnalyticsLayout {
  if (typeof window === "undefined") return "panels";
  const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  return LAYOUTS.includes(raw as AnalyticsLayout)
    ? (raw as AnalyticsLayout)
    : "panels";
}

function formatShortDate(iso: string): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return day.length >= 10 ? day.slice(5) : day;
}

export default function OwnerAnalyticsPage() {
  const { t } = useT();
  const { user, ready: sessionReady } = useAppSession();
  const { storeId, ready: storeReady } = useAppStoreId();
  const isOwner = user?.clientRole === "OWNER";
  const [report, setReport] = useState<OwnerAnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffTab, setStaffTab] = useState<StaffTab>("adds");
  const [layout, setLayout] = useState<AnalyticsLayout>("panels");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    setLayout(readLayout());
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (!isOwner) {
      replaceApp("/app");
    }
  }, [sessionReady, isOwner]);

  useEffect(() => {
    if (!sessionReady || !isOwner) return;
    if (!storeReady) return;
    if (!storeId) {
      setReport(null);
      setLoading(false);
      setError(t("errors.noStoreAccess"));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetailProductId(null);

    void (async () => {
      try {
        const params = new URLSearchParams({ storeId });
        const response = await fetch(
          `/api/analytics/owner?${params.toString()}`,
        );
        const data = (await response.json().catch(() => null)) as {
          report?: OwnerAnalyticsReport;
          error?: string;
        } | null;
        if (cancelled) return;
        if (response.status === 403) {
          replaceApp("/app");
          setReport(null);
          return;
        }
        if (!response.ok || !data?.report) {
          setError(data?.error ?? t("errors.networkError"));
          setReport(null);
          return;
        }
        setReport(data.report);
      } catch {
        if (!cancelled) {
          setError(t("errors.networkError"));
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t, storeId, storeReady, sessionReady, isOwner]);

  function chooseLayout(next: AnalyticsLayout) {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const trend = report?.waste.trendPct;
  const trendTone =
    trend == null
      ? "default"
      : trend > 0
        ? "danger"
        : trend < 0
          ? "ok"
          : "default";
  const trendLabel =
    trend == null
      ? t("analytics.trendNone")
      : trend > 0
        ? t("analytics.trendUp", { pct: trend })
        : trend < 0
          ? t("analytics.trendDown", { pct: Math.abs(trend) })
          : t("analytics.trendFlat");

  const staffRows =
    report == null
      ? []
      : staffTab === "adds"
        ? report.staff.adds
        : staffTab === "removes"
          ? report.staff.removes
          : report.staff.markdowns;

  const detailProduct = useMemo(() => {
    if (!report || !detailProductId) return null;
    return (
      report.topWasteProducts.find((p) => p.productId === detailProductId) ??
      null
    );
  }, [report, detailProductId]);

  const overviewPanel = report ? (
    <ChartPanel
      title={t("analytics.overviewTitle")}
      subtitle={t("analytics.overviewHint")}
    >
      <div className="grid grid-cols-2 gap-2">
        <KpiTile
          label={t("analytics.missedLabel")}
          value={String(report.missedExpired.quantity)}
          hint={t("analytics.missedHint", {
            count: report.missedExpired.entryCount,
          })}
          tone={report.missedExpired.quantity > 0 ? "danger" : "ok"}
        />
        <KpiTile
          label={t("analytics.wasteWeek")}
          value={String(report.waste.thisWeekQty)}
          hint={t("analytics.pieces")}
          tone={report.waste.thisWeekQty > 0 ? "warn" : "ok"}
        />
        <KpiTile
          label={t("analytics.wasteMonth")}
          value={String(report.waste.thisMonthQty)}
          hint={trendLabel}
          tone={trendTone}
        />
        <KpiTile
          label={t("analytics.coverageGapsShort")}
          value={String(report.shiftCoverage.gapDays)}
          hint={t("analytics.coverageGapsHint", {
            days: report.shiftCoverage.daysChecked,
          })}
          tone={report.shiftCoverage.gapDays > 0 ? "danger" : "ok"}
        />
      </div>
    </ChartPanel>
  ) : null;

  const topWastePanel = report ? (
    <ChartPanel
      title={t("analytics.topWasteTitle")}
      subtitle={t("analytics.topWasteHint")}
    >
      <RankBars
        rows={report.topWasteProducts.map((row) => ({
          id: row.productId,
          label: row.name,
          value: row.writeOffQty,
          hint: t("analytics.topWasteRowHint", {
            events: row.events,
            week: row.weekQty,
          }),
        }))}
        emptyLabel={t("analytics.topWasteEmpty")}
        onSelect={setDetailProductId}
        selectHint={t("analytics.tapForDetails")}
      />
    </ChartPanel>
  ) : null;

  const wasteChartPanel = report ? (
    <ChartPanel
      title={t("analytics.wasteChartTitle")}
      subtitle={t("analytics.wasteChartHint")}
    >
      <CompareBars
        rows={[
          {
            label: t("analytics.compareWeek"),
            current: report.waste.thisWeekQty,
            prior: report.waste.priorWeekQty,
            currentLabel: t("analytics.barThis"),
            priorLabel: t("analytics.barPrior"),
          },
          {
            label: t("analytics.compareMonth"),
            current: report.waste.thisMonthQty,
            prior: report.waste.priorMonthQty,
            currentLabel: t("analytics.barThis"),
            priorLabel: t("analytics.barPrior"),
          },
        ]}
      />
      <div className="mt-4 border-t border-card-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted">
          {t("analytics.wasteDailyTitle")}
        </p>
        <DayBars
          days={report.waste.byDay}
          emptyLabel={t("analytics.wasteDailyEmpty")}
        />
      </div>
    </ChartPanel>
  ) : null;

  const storesPanel = report ? (
    <ChartPanel
      title={t("analytics.storeAnomalySection")}
      subtitle={t("analytics.storeChartHint")}
    >
      <RankBars
        rows={report.storeAnomalies.map((row) => ({
          id: row.storeId,
          label: row.storeName,
          value: row.thisWeekQty,
          hint: t("analytics.storeWasteCompare", {
            week: row.thisWeekQty,
            prior: row.priorWeekQty,
          }),
        }))}
        emptyLabel={t("analytics.storeAnomalyEmpty")}
        highlight={(row) =>
          Boolean(
            report.storeAnomalies.find((s) => s.storeId === row.id)?.spike,
          )
        }
      />
    </ChartPanel>
  ) : null;

  const attentionPanel = report ? (
    <ChartPanel
      title={t("analytics.attentionTitle")}
      subtitle={t("analytics.attentionHint")}
    >
      <p className="mb-1.5 text-xs font-medium text-muted">
        {t("analytics.missedSection")}
      </p>
      {report.missedExpired.samples.length === 0 ? (
        <p className="mb-3 text-sm text-muted">{t("analytics.missedEmpty")}</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {report.missedExpired.samples.slice(0, 5).map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-danger/35 px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{item.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {item.quantity} · {item.expiryDate.slice(5)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-1.5 text-xs font-medium text-muted">
        {t("analytics.markdownWasteSection")}
      </p>
      {report.markdownThenWaste.length === 0 ? (
        <p className="text-sm text-muted">{t("analytics.markdownWasteEmpty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {report.markdownThenWaste.slice(0, 5).map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex items-start justify-between gap-2 rounded-lg border border-warning-fg/35 px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{item.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {t("analytics.writeOffOf", {
                  writeOff: item.writeOffQuantity,
                  qty: item.quantity,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartPanel>
  ) : null;

  const staffPanel = report ? (
    <ChartPanel
      title={t("analytics.staffSection")}
      subtitle={t("analytics.staffChartHint")}
    >
      <SegmentTabs
        value={staffTab}
        onChange={(id) => setStaffTab(id as StaffTab)}
        options={[
          { id: "adds", label: t("analytics.staffTabAdds") },
          { id: "removes", label: t("analytics.staffTabRemoves") },
          { id: "markdowns", label: t("analytics.staffTabMarkdowns") },
        ]}
      />
      <RankBars
        rows={staffRows.map((row) => ({
          id: `${staffTab}-${row.userId || row.username}`,
          label: row.username,
          value: row.count,
        }))}
        emptyLabel={t("analytics.staffEmpty")}
      />
    </ChartPanel>
  ) : null;

  const coveragePanel = report ? (
    <ChartPanel
      title={t("analytics.coverageSection")}
      subtitle={t("analytics.coverageSummary", {
        gaps: report.shiftCoverage.gapDays,
        days: report.shiftCoverage.daysChecked,
      })}
    >
      <CoverageStrip
        days={report.shiftCoverage.days}
        legendOk={t("analytics.coverageLegendOk")}
        legendGap={t("analytics.coverageLegendGap")}
        legendQuiet={t("analytics.coverageLegendQuiet")}
      />
      {report.shiftCoverage.gaps.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {report.shiftCoverage.gaps.map((gap) => (
            <li
              key={gap.date}
              className="flex justify-between rounded-lg border border-card-border px-2.5 py-1.5 text-sm"
            >
              <span className="font-medium">{gap.date}</span>
              <span className="text-xs text-muted">
                {t("analytics.coverageGap", { count: gap.dueCount })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("analytics.coverageEmpty")}</p>
      )}
    </ChartPanel>
  ) : null;

  const markdownPanel = report ? (
    <ChartPanel title={t("analytics.markdownSection")}>
      <CompareBars
        rows={[
          {
            label: t("analytics.thisMonth"),
            current: report.markdown.reducedCount,
            prior: report.markdown.restoredCount,
            currentLabel: t("analytics.markdownOn"),
            priorLabel: t("analytics.markdownOff"),
          },
        ]}
      />
      <div className="mt-4 border-t border-card-border pt-3">
        <p className="mb-2 text-xs font-medium text-muted">
          {t("analytics.revertsSection")}
        </p>
        <RankBars
          rows={report.reverts.byUser.map((row) => ({
            id: `rev-${row.userId || row.username}`,
            label: row.username,
            value: row.count,
          }))}
          emptyLabel={t("analytics.revertsEmpty")}
        />
      </div>
    </ChartPanel>
  ) : null;

  function renderLayout(): ReactNode {
    if (!report) return null;

    if (layout === "focus") {
      return (
        <>
          {overviewPanel}
          {topWastePanel}
          {wasteChartPanel}
          {!showMore ? (
            <button
              type="button"
              className={`${appButtonNeutral} mt-4 w-full`}
              onClick={() => setShowMore(true)}
            >
              {t("analytics.showMoreSections")}
            </button>
          ) : (
            <>
              {storesPanel}
              {attentionPanel}
              {staffPanel}
              {coveragePanel}
              {markdownPanel}
              <button
                type="button"
                className={`${appButtonNeutral} mt-4 w-full`}
                onClick={() => setShowMore(false)}
              >
                {t("analytics.showLessSections")}
              </button>
            </>
          )}
        </>
      );
    }

    if (layout === "compact") {
      return (
        <>
          {overviewPanel}
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-2">
            <div>{topWastePanel}</div>
            <div>{wasteChartPanel}</div>
          </div>
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-2">
            <div>{storesPanel}</div>
            <div>{staffPanel}</div>
          </div>
          {attentionPanel}
          {coveragePanel}
          {markdownPanel}
        </>
      );
    }

    // panels (default)
    return (
      <>
        {overviewPanel}
        {topWastePanel}
        {wasteChartPanel}
        {storesPanel}
        {attentionPanel}
        {staffPanel}
        {coveragePanel}
        {markdownPanel}
      </>
    );
  }

  return (
    <div
      className={`${appPageShell} flex min-h-[calc(100svh-var(--app-bottom-nav-frame,0px))] flex-col pb-8 pt-1`}
    >
      <div className={appChromeInset}>
        <MobilePageHeader title={t("analytics.title")} />
      </div>

      <div className={`${appListInset} mt-2 flex-1`}>
        {!sessionReady || !isOwner || loading ? (
          <LoadingSpinnerPage />
        ) : null}

        {sessionReady && isOwner && !loading && error ? (
          <p className="mt-4 text-sm text-danger">{error}</p>
        ) : null}

        {sessionReady && isOwner && !loading && report ? (
          <>
            <div className="mb-1 grid grid-cols-3 gap-1 rounded-xl border border-card-border p-1">
              {LAYOUTS.map((id) => {
                const active = layout === id;
                const label =
                  id === "panels"
                    ? t("analytics.layoutPanels")
                    : id === "focus"
                      ? t("analytics.layoutFocus")
                      : t("analytics.layoutCompact");
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => chooseLayout(id)}
                    className={`rounded-lg px-1.5 py-2 text-[0.7rem] font-semibold ${
                      active
                        ? "border border-primary text-primary"
                        : "border border-transparent text-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mb-2 text-[0.65rem] text-muted">
              {t("analytics.layoutHint")}
            </p>
            {renderLayout()}
          </>
        ) : null}
      </div>

      {detailProduct ? (
        <WasteProductDetailSheet
          product={detailProduct}
          onClose={() => setDetailProductId(null)}
          piecesLabel={t("analytics.pieces")}
          title={t("analytics.productDetailTitle")}
          closeLabel={t("common.cancel")}
          monthLabel={t("analytics.wasteMonth")}
          weekLabel={t("analytics.wasteWeek")}
          eventsLabel={t("analytics.productEvents")}
          storesLabel={t("analytics.productStores")}
          recentLabel={t("analytics.productRecent")}
          markdownBadge={t("analytics.hadMarkdown")}
          writeOffOf={(writeOff, qty) =>
            t("analytics.writeOffOf", { writeOff, qty })
          }
        />
      ) : null}
    </div>
  );
}

function WasteProductDetailSheet({
  product,
  onClose,
  piecesLabel,
  title,
  closeLabel,
  monthLabel,
  weekLabel,
  eventsLabel,
  storesLabel,
  recentLabel,
  markdownBadge,
  writeOffOf,
}: {
  product: TopWasteProduct;
  onClose: () => void;
  piecesLabel: string;
  title: string;
  closeLabel: string;
  monthLabel: string;
  weekLabel: string;
  eventsLabel: string;
  storesLabel: string;
  recentLabel: string;
  markdownBadge: string;
  writeOffOf: (writeOff: number, qty: number) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-2xl border border-card-border bg-background p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {title}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            className={`${appButtonNeutral} shrink-0 px-2.5 py-1.5 text-xs`}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <KpiTile
            label={monthLabel}
            value={String(product.writeOffQty)}
            hint={piecesLabel}
            tone="warn"
          />
          <KpiTile
            label={weekLabel}
            value={String(product.weekQty)}
            hint={piecesLabel}
          />
          <KpiTile
            label={eventsLabel}
            value={String(product.events)}
            hint={formatShortDate(product.lastRemovedAt)}
          />
        </div>

        {product.storeNames.length > 0 ? (
          <p className="mt-3 text-xs text-muted">
            {storesLabel}: {product.storeNames.join(", ")}
          </p>
        ) : null}

        <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">
          {recentLabel}
        </h3>
        <ul className="space-y-2">
          {product.recent.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-card-border px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold tabular-nums text-foreground">
                  {writeOffOf(event.writeOffQuantity, event.quantity)}
                </span>
                <span className="text-xs text-muted">
                  {formatShortDate(event.removedAt)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {event.storeName} · {event.expiryDate}
                {event.hadMarkdown ? ` · ${markdownBadge}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
