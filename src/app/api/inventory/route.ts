import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditInventoryAdded,
  auditInventoryMerged,
  auditInventoryRemoved,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { purgeExpiredInventory } from "@/lib/inventory-purge";
import { expiryListDateBounds, expiryListMaxPast, parseExpiryWithinDays } from "@/lib/expiry";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  normalizeExpiryDate,
} from "@/lib/inventory";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

async function userCanAccessStore(userId: string, storeId: string) {
  const link = await db.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
    include: { store: true },
  });
  return link?.store.active ? link.store : null;
}

const createSchema = z.object({
  storeId: z.string().min(1),
  barcode: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  expiryDate: z.string().datetime(),
});

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const barcode = normalizeBarcode(parsed.data.barcode);
  if (!barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const product = await db.product.findFirst({
    where: {
      id: parsed.data.productId,
      barcode: { in: barcodeLookupValues(barcode) },
    },
  });
  if (!product) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const expiryDate = normalizeExpiryDate(new Date(parsed.data.expiryDate));
  const { start, end } = expiryDateDayBounds(expiryDate);

  const existing = await db.inventoryEntry.findFirst({
    where: {
      storeId: parsed.data.storeId,
      productId: product.id,
      ...activeInventoryWhere,
      expiryDate: { gte: start, lt: end },
    },
    orderBy: { enteredAt: "asc" },
  });

  if (existing) {
    const entry = await db.inventoryEntry.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + parsed.data.quantity,
        expiryDate,
      },
      include: { product: true },
    });

    await logAuditEvent(
      request,
      session,
      "inventory_merged",
      auditInventoryMerged({
        productName: product.name,
        barcode: product.barcode,
        addedQty: parsed.data.quantity,
        totalQty: entry.quantity,
        storeName: store.name,
        expiryDate,
      }),
    );

    return NextResponse.json({ entry, merged: true });
  }

  const entry = await db.inventoryEntry.create({
    data: {
      storeId: parsed.data.storeId,
      productId: product.id,
      barcode: product.barcode,
      quantity: parsed.data.quantity,
      expiryDate,
    },
    include: { product: true },
  });

  await logAuditEvent(
    request,
    session,
    "inventory_added",
    auditInventoryAdded({
      productName: product.name,
      barcode: product.barcode,
      quantity: parsed.data.quantity,
      storeName: store.name,
      expiryDate,
    }),
  );

  return NextResponse.json({ entry, merged: false }, { status: 201 });
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");
  if (!storeId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const now = new Date();
  await purgeExpiredInventory();

  const withinDays = parseExpiryWithinDays(searchParams.get("withinDays"));
  const maxPast = expiryListMaxPast(now);
  const maxFuture =
    withinDays === "all" ? null : expiryListDateBounds(now, withinDays).maxFuture;
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  const baseWhere = {
    storeId,
    ...activeInventoryWhere,
    expiryDate: {
      gte: maxPast,
      ...(maxFuture ? { lte: maxFuture } : {}),
    },
  };

  const where = q
    ? {
        ...baseWhere,
        OR: [
          { barcode: q },
          { barcode: { contains: q } },
          { product: { name: { contains: q } } },
        ],
      }
    : baseWhere;

  const orderBy = { expiryDate: "asc" as const };

  if (q) {
    const entries = await db.inventoryEntry.findMany({
      where,
      include: { product: true },
      orderBy,
      take: 100,
    });

    return NextResponse.json({
      entries,
      pagination: {
        page: 1,
        limit: entries.length,
        total: entries.length,
        totalPages: 1,
      },
    });
  }

  const [entries, total] = await Promise.all([
    db.inventoryEntry.findMany({
      where,
      include: { product: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.inventoryEntry.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    entries,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

const removeSchema = z.object({
  entryId: z.string().min(1),
  storeId: z.string().min(1),
});

export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = removeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const removed = await db.inventoryEntry.findFirst({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      ...activeInventoryWhere,
    },
    include: { product: true },
  });

  const entry = await db.inventoryEntry.updateMany({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      ...activeInventoryWhere,
    },
    data: { removedAt: new Date() },
  });

  if (entry.count === 0) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  if (removed) {
    await logAuditEvent(
      request,
      session,
      "inventory_removed",
      auditInventoryRemoved({
        productName: removed.product.name,
        barcode: removed.barcode,
        quantity: removed.quantity,
        storeName: store.name,
        expiryDate: removed.expiryDate,
      }),
    );
  }

  return NextResponse.json({ ok: true });
}
