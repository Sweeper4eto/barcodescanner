import { db } from "@/lib/db";
import { activeInventoryWhere } from "@/lib/inventory";
import {
  addUtcDays,
  isWasteSpike,
  priorMonthWindow,
  priorWeekWindow,
  startOfUtcDay,
  thisMonthWindow,
  thisWeekWindow,
  topStaff,
  trendPercent,
  ymdUtc,
} from "@/lib/owner-analytics";

const CHECK_EVENTS = [
  "inventory_added",
  "inventory_merged",
  "inventory_updated",
  "inventory_removed",
  "inventory_price_reduced",
  "inventory_price_restored",
] as const;

export type OwnerAnalyticsReport = {
  generatedAt: string;
  missedExpired: {
    entryCount: number;
    quantity: number;
    samples: Array<{
      id: string;
      name: string;
      quantity: number;
      expiryDate: string;
      storeName: string;
    }>;
  };
  waste: {
    thisWeekQty: number;
    priorWeekQty: number;
    thisMonthQty: number;
    priorMonthQty: number;
    trendPct: number | null;
    /** Last 14 UTC days (oldest → newest), write-off qty per day. */
    byDay: Array<{ date: string; qty: number }>;
  };
  markdown: {
    reducedCount: number;
    restoredCount: number;
  };
  markdownThenWaste: Array<{
    name: string;
    quantity: number;
    writeOffQuantity: number;
    storeName: string;
    removedAt: string;
  }>;
  storeAnomalies: Array<{
    storeId: string;
    storeName: string;
    thisWeekQty: number;
    priorWeekQty: number;
    spike: boolean;
  }>;
  staff: {
    adds: ReturnType<typeof topStaff>;
    removes: ReturnType<typeof topStaff>;
    markdowns: ReturnType<typeof topStaff>;
  };
  shiftCoverage: {
    daysChecked: number;
    gapDays: number;
    /** Last 14 UTC days for the coverage strip. */
    days: Array<{
      date: string;
      dueCount: number;
      checked: boolean;
      gap: boolean;
    }>;
    gaps: Array<{
      date: string;
      dueCount: number;
      checkers: string[];
    }>;
  };
  reverts: {
    count: number;
    byUser: ReturnType<typeof topStaff>;
  };
  /** Top products by write-off qty this month (with recent event rows). */
  topWasteProducts: Array<{
    productId: string;
    name: string;
    writeOffQty: number;
    events: number;
    weekQty: number;
    storeNames: string[];
    lastRemovedAt: string;
    recent: Array<{
      id: string;
      writeOffQuantity: number;
      quantity: number;
      storeName: string;
      removedAt: string;
      expiryDate: string;
      hadMarkdown: boolean;
    }>;
  }>;
};

export type TopWasteProduct = OwnerAnalyticsReport["topWasteProducts"][number];

async function sumWriteOff(
  clientId: string,
  start: Date,
  end: Date,
  storeId?: string,
): Promise<number> {
  const rows = await db.inventoryEntry.findMany({
    where: {
      store: { clientId, ...(storeId ? { id: storeId } : {}) },
      removedAt: { gte: start, lt: end },
      writeOffQuantity: { gt: 0 },
      deletedAt: null,
    },
    select: { writeOffQuantity: true },
  });
  return rows.reduce((sum, row) => sum + (row.writeOffQuantity ?? 0), 0);
}

export async function buildOwnerAnalyticsReport(
  clientId: string,
  options?: { storeId?: string; now?: Date },
): Promise<OwnerAnalyticsReport> {
  const now = options?.now ?? new Date();
  const storeFilter = options?.storeId
    ? { id: options.storeId, clientId }
    : { clientId };

  const stores = await db.store.findMany({
    where: storeFilter,
    select: { id: true, name: true },
  });
  const storeIds = stores.map((s) => s.id);
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  if (storeIds.length === 0) {
    return emptyReport(now);
  }

  const today = startOfUtcDay(now);
  const week = thisWeekWindow(now);
  const priorWeek = priorWeekWindow(now);
  const month = thisMonthWindow(now);
  const priorMonth = priorMonthWindow(now);
  const staffSince = addUtcDays(now, -30);
  const coverageSince = addUtcDays(now, -13);

  const [
    missed,
    wasteWeek,
    wastePriorWeek,
    wasteMonth,
    wastePriorMonth,
    markdownReduced,
    markdownRestored,
    markdownThenWasteRows,
    wasteRowsWeek,
    wasteRowsPriorWeek,
    wasteRowsDaily,
    wasteMonthProductRows,
    staffAdds,
    staffRemoves,
    staffMarkdowns,
    dueEntries,
    checkAudits,
    revertAudits,
  ] = await Promise.all([
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        ...activeInventoryWhere,
        expiryDate: { lt: today },
      },
      select: {
        id: true,
        quantity: true,
        expiryDate: true,
        storeId: true,
        product: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 50,
    }),
    sumWriteOff(clientId, week.start, week.end, options?.storeId),
    sumWriteOff(clientId, priorWeek.start, priorWeek.end, options?.storeId),
    sumWriteOff(clientId, month.start, month.end, options?.storeId),
    sumWriteOff(clientId, priorMonth.start, priorMonth.end, options?.storeId),
    db.auditLog.count({
      where: {
        storeId: { in: storeIds },
        event: "inventory_price_reduced",
        occurredAt: { gte: month.start, lt: month.end },
      },
    }),
    db.auditLog.count({
      where: {
        storeId: { in: storeIds },
        event: "inventory_price_restored",
        occurredAt: { gte: month.start, lt: month.end },
      },
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: { gte: month.start, lt: month.end },
        writeOffQuantity: { gt: 0 },
        priceReducedAt: { not: null },
        deletedAt: null,
      },
      select: {
        quantity: true,
        writeOffQuantity: true,
        removedAt: true,
        storeId: true,
        product: { select: { name: true } },
      },
      orderBy: { removedAt: "desc" },
      take: 20,
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: { gte: week.start, lt: week.end },
        writeOffQuantity: { gt: 0 },
        deletedAt: null,
      },
      select: { storeId: true, writeOffQuantity: true },
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: { gte: priorWeek.start, lt: priorWeek.end },
        writeOffQuantity: { gt: 0 },
        deletedAt: null,
      },
      select: { storeId: true, writeOffQuantity: true },
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: { gte: coverageSince, lt: addUtcDays(now, 1) },
        writeOffQuantity: { gt: 0 },
        deletedAt: null,
      },
      select: { removedAt: true, writeOffQuantity: true },
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: { gte: month.start, lt: month.end },
        writeOffQuantity: { gt: 0 },
        deletedAt: null,
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        writeOffQuantity: true,
        removedAt: true,
        expiryDate: true,
        storeId: true,
        priceReducedAt: true,
        product: { select: { name: true } },
      },
      orderBy: { removedAt: "desc" },
      take: 800,
    }),
    db.auditLog.findMany({
      where: {
        storeId: { in: storeIds },
        event: { in: ["inventory_added", "inventory_merged"] },
        occurredAt: { gte: staffSince },
      },
      select: { userId: true, username: true },
    }),
    db.auditLog.findMany({
      where: {
        storeId: { in: storeIds },
        event: "inventory_removed",
        occurredAt: { gte: staffSince },
      },
      select: { userId: true, username: true },
    }),
    db.auditLog.findMany({
      where: {
        storeId: { in: storeIds },
        event: "inventory_price_reduced",
        occurredAt: { gte: staffSince },
      },
      select: { userId: true, username: true },
    }),
    db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        deletedAt: null,
        expiryDate: { gte: coverageSince, lt: addUtcDays(now, 1) },
      },
      select: { expiryDate: true },
    }),
    db.auditLog.findMany({
      where: {
        storeId: { in: storeIds },
        event: { in: [...CHECK_EVENTS] },
        occurredAt: { gte: coverageSince, lt: addUtcDays(now, 1) },
      },
      select: { occurredAt: true, username: true },
    }),
    db.auditLog.findMany({
      where: {
        storeId: { in: storeIds },
        event: "activity_reverted",
        occurredAt: { gte: month.start, lt: month.end },
      },
      select: { userId: true, username: true },
    }),
  ]);

  const missedQty = missed.reduce((sum, row) => sum + row.quantity, 0);

  const weekByStore = new Map<string, number>();
  for (const row of wasteRowsWeek) {
    weekByStore.set(
      row.storeId,
      (weekByStore.get(row.storeId) ?? 0) + (row.writeOffQuantity ?? 0),
    );
  }
  const priorWeekByStore = new Map<string, number>();
  for (const row of wasteRowsPriorWeek) {
    priorWeekByStore.set(
      row.storeId,
      (priorWeekByStore.get(row.storeId) ?? 0) + (row.writeOffQuantity ?? 0),
    );
  }

  const storeAnomalies = stores
    .map((store) => {
      const thisWeekQty = weekByStore.get(store.id) ?? 0;
      const priorWeekQty = priorWeekByStore.get(store.id) ?? 0;
      return {
        storeId: store.id,
        storeName: store.name,
        thisWeekQty,
        priorWeekQty,
        spike: isWasteSpike(thisWeekQty, priorWeekQty),
      };
    })
    .filter((row) => row.thisWeekQty > 0 || row.priorWeekQty > 0)
    .sort((a, b) => Number(b.spike) - Number(a.spike) || b.thisWeekQty - a.thisWeekQty);

  const dueByDay = new Map<string, number>();
  for (const row of dueEntries) {
    const key = ymdUtc(row.expiryDate);
    dueByDay.set(key, (dueByDay.get(key) ?? 0) + 1);
  }
  const checkersByDay = new Map<string, Set<string>>();
  for (const row of checkAudits) {
    const key = ymdUtc(row.occurredAt);
    const set = checkersByDay.get(key) ?? new Set();
    set.add(row.username);
    checkersByDay.set(key, set);
  }

  const gaps: OwnerAnalyticsReport["shiftCoverage"]["gaps"] = [];
  const coverageDays: OwnerAnalyticsReport["shiftCoverage"]["days"] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = addUtcDays(coverageSince, i);
    if (day > today) break;
    const key = ymdUtc(day);
    const dueCount = dueByDay.get(key) ?? 0;
    const checkers = [...(checkersByDay.get(key) ?? [])];
    const checked = checkers.length > 0;
    const gap = dueCount >= 3 && !checked;
    coverageDays.push({ date: key, dueCount, checked, gap });
    if (gap) {
      gaps.push({ date: key, dueCount, checkers });
    }
  }

  const qtyByDay = new Map<string, number>();
  for (const row of wasteRowsDaily) {
    if (!row.removedAt) continue;
    const key = ymdUtc(row.removedAt);
    qtyByDay.set(key, (qtyByDay.get(key) ?? 0) + (row.writeOffQuantity ?? 0));
  }
  const wasteByDay: Array<{ date: string; qty: number }> = [];
  for (let i = 0; i < 14; i += 1) {
    const day = addUtcDays(coverageSince, i);
    if (day > today) break;
    const key = ymdUtc(day);
    wasteByDay.push({ date: key, qty: qtyByDay.get(key) ?? 0 });
  }

  type WasteAgg = {
    productId: string;
    name: string;
    writeOffQty: number;
    events: number;
    weekQty: number;
    storeIds: Set<string>;
    lastRemovedAt: Date | null;
    recent: TopWasteProduct["recent"];
  };
  const wasteByProduct = new Map<string, WasteAgg>();
  for (const row of wasteMonthProductRows) {
    const qty = row.writeOffQuantity ?? 0;
    if (qty <= 0 || !row.removedAt) continue;
    const existing = wasteByProduct.get(row.productId);
    const event = {
      id: row.id,
      writeOffQuantity: qty,
      quantity: row.quantity,
      storeName: storeNameById.get(row.storeId) ?? "—",
      removedAt: row.removedAt.toISOString(),
      expiryDate: ymdUtc(row.expiryDate),
      hadMarkdown: row.priceReducedAt != null,
    };
    if (existing) {
      existing.writeOffQty += qty;
      existing.events += 1;
      existing.storeIds.add(row.storeId);
      if (
        !existing.lastRemovedAt ||
        row.removedAt > existing.lastRemovedAt
      ) {
        existing.lastRemovedAt = row.removedAt;
      }
      if (existing.recent.length < 12) existing.recent.push(event);
    } else {
      wasteByProduct.set(row.productId, {
        productId: row.productId,
        name: row.product.name.trim() || "—",
        writeOffQty: qty,
        events: 1,
        weekQty: 0,
        storeIds: new Set([row.storeId]),
        lastRemovedAt: row.removedAt,
        recent: [event],
      });
    }
  }
  for (const row of wasteMonthProductRows) {
    if (!row.removedAt || row.removedAt < week.start || row.removedAt >= week.end) {
      continue;
    }
    const agg = wasteByProduct.get(row.productId);
    if (agg) agg.weekQty += row.writeOffQuantity ?? 0;
  }
  const topWasteProducts: TopWasteProduct[] = [...wasteByProduct.values()]
    .sort((a, b) => b.writeOffQty - a.writeOffQty)
    .slice(0, 12)
    .map((agg) => ({
      productId: agg.productId,
      name: agg.name,
      writeOffQty: agg.writeOffQty,
      events: agg.events,
      weekQty: agg.weekQty,
      storeNames: [...agg.storeIds]
        .map((id) => storeNameById.get(id) ?? "—")
        .sort(),
      lastRemovedAt: agg.lastRemovedAt
        ? agg.lastRemovedAt.toISOString()
        : "",
      recent: agg.recent,
    }));

  return {
    generatedAt: now.toISOString(),
    missedExpired: {
      entryCount: missed.length,
      quantity: missedQty,
      samples: missed.slice(0, 8).map((row) => ({
        id: row.id,
        name: row.product.name.trim() || "—",
        quantity: row.quantity,
        expiryDate: ymdUtc(row.expiryDate),
        storeName: storeNameById.get(row.storeId) ?? "—",
      })),
    },
    waste: {
      thisWeekQty: wasteWeek,
      priorWeekQty: wastePriorWeek,
      thisMonthQty: wasteMonth,
      priorMonthQty: wastePriorMonth,
      trendPct: trendPercent(wasteMonth, wastePriorMonth),
      byDay: wasteByDay,
    },
    markdown: {
      reducedCount: markdownReduced,
      restoredCount: markdownRestored,
    },
    markdownThenWaste: markdownThenWasteRows.map((row) => ({
      name: row.product.name.trim() || "—",
      quantity: row.quantity,
      writeOffQuantity: row.writeOffQuantity ?? 0,
      storeName: storeNameById.get(row.storeId) ?? "—",
      removedAt: row.removedAt ? row.removedAt.toISOString() : "",
    })),
    storeAnomalies,
    staff: {
      adds: topStaff(staffAdds),
      removes: topStaff(staffRemoves),
      markdowns: topStaff(staffMarkdowns),
    },
    shiftCoverage: {
      daysChecked: 14,
      gapDays: gaps.length,
      days: coverageDays,
      gaps,
    },
    reverts: {
      count: revertAudits.length,
      byUser: topStaff(revertAudits),
    },
    topWasteProducts,
  };
}

function emptyReport(now: Date): OwnerAnalyticsReport {
  return {
    generatedAt: now.toISOString(),
    missedExpired: { entryCount: 0, quantity: 0, samples: [] },
    waste: {
      thisWeekQty: 0,
      priorWeekQty: 0,
      thisMonthQty: 0,
      priorMonthQty: 0,
      trendPct: null,
      byDay: [],
    },
    markdown: { reducedCount: 0, restoredCount: 0 },
    markdownThenWaste: [],
    storeAnomalies: [],
    staff: { adds: [], removes: [], markdowns: [] },
    shiftCoverage: { daysChecked: 14, gapDays: 0, days: [], gaps: [] },
    reverts: { count: 0, byUser: [] },
    topWasteProducts: [],
  };
}
