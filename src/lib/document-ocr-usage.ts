import { db } from "@/lib/db";

export async function recordDocumentOcrScan(input: {
  userId: string;
  username: string;
  storeId: string;
}): Promise<void> {
  try {
    await db.documentOcrScan.create({
      data: {
        userId: input.userId,
        username: input.username,
        storeId: input.storeId,
      },
    });
  } catch (error) {
    console.error("document OCR scan log failed", error);
  }
}

function parseDayBound(
  value: string | null | undefined,
  endOfDay: boolean,
): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function ymdLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function eachDayInclusive(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor.getTime() <= end.getTime()) {
    days.push(ymdLocal(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export type DocumentOcrUsageRow = {
  userId: string;
  username: string;
  clientId: string | null;
  clientName: string | null;
  homeUser: boolean;
  scanCount: number;
  lastScanAt: string;
};

export type DocumentOcrDailyRow = {
  day: string;
  count: number;
};

export type DocumentOcrPeriodSummaries = {
  days7: number;
  days14: number;
  days30: number;
};

export async function queryDocumentOcrUsage(input: {
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}): Promise<{
  rows: DocumentOcrUsageRow[];
  daily: DocumentOcrDailyRow[];
  totalScans: number;
  summaries: DocumentOcrPeriodSummaries;
}> {
  const from = parseDayBound(input.dateFrom, false) ?? startOfLocalDay(6);
  const to = parseDayBound(input.dateTo, true) ?? new Date();
  if (to.getTime() < from.getTime()) {
    return {
      rows: [],
      daily: [],
      totalScans: 0,
      summaries: await loadPeriodSummaries(),
    };
  }

  const where = {
    createdAt: {
      gte: from,
      lte: to,
    },
  };

  const [scans, summaries] = await Promise.all([
    db.documentOcrScan.findMany({
      where,
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    loadPeriodSummaries(),
  ]);

  if (scans.length === 0) {
    return {
      rows: [],
      daily: eachDayInclusive(from, to).map((day) => ({ day, count: 0 })),
      totalScans: 0,
      summaries,
    };
  }

  const userIds = [...new Set(scans.map((scan) => scan.userId))];
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      clientId: true,
      client: { select: { name: true, homeUser: true } },
    },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  const needle = input.q?.trim().toLowerCase() ?? "";
  const allowedUserIds = new Set<string>();
  for (const userId of userIds) {
    const user = userById.get(userId);
    const username = user?.username ?? userId;
    const clientName = user?.client?.name ?? null;
    if (
      !needle ||
      username.toLowerCase().includes(needle) ||
      (clientName?.toLowerCase().includes(needle) ?? false)
    ) {
      allowedUserIds.add(userId);
    }
  }

  const perUser = new Map<
    string,
    { count: number; lastScanAt: Date }
  >();
  const perDay = new Map<string, number>();
  for (const day of eachDayInclusive(from, to)) {
    perDay.set(day, 0);
  }

  let totalScans = 0;
  for (const scan of scans) {
    if (!allowedUserIds.has(scan.userId)) continue;
    totalScans += 1;
    const day = ymdLocal(scan.createdAt);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    const prev = perUser.get(scan.userId);
    if (!prev) {
      perUser.set(scan.userId, { count: 1, lastScanAt: scan.createdAt });
    } else {
      prev.count += 1;
      if (scan.createdAt > prev.lastScanAt) prev.lastScanAt = scan.createdAt;
    }
  }

  const rows: DocumentOcrUsageRow[] = [...perUser.entries()]
    .map(([userId, stats]) => {
      const user = userById.get(userId);
      return {
        userId,
        username: user?.username ?? userId,
        clientId: user?.clientId ?? null,
        clientName: user?.client?.name ?? null,
        homeUser: user?.client?.homeUser ?? false,
        scanCount: stats.count,
        lastScanAt: stats.lastScanAt.toISOString(),
      };
    })
    .sort((a, b) => b.scanCount - a.scanCount);

  const daily: DocumentOcrDailyRow[] = [...perDay.entries()].map(
    ([day, count]) => ({ day, count }),
  );

  return { rows, daily, totalScans, summaries };
}

async function loadPeriodSummaries(): Promise<DocumentOcrPeriodSummaries> {
  const now = new Date();
  const [days7, days14, days30] = await Promise.all([
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfLocalDay(6), lte: now } },
    }),
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfLocalDay(13), lte: now } },
    }),
    db.documentOcrScan.count({
      where: { createdAt: { gte: startOfLocalDay(29), lte: now } },
    }),
  ]);
  return { days7, days14, days30 };
}
