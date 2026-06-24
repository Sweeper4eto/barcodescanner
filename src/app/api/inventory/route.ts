import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { purgeExpiredInventory } from "@/lib/inventory-purge";
import { expiryListVisible } from "@/lib/expiry";
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

  const store = await userCanAccessStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
  });
  if (!product || product.barcode !== parsed.data.barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const entry = await db.inventoryEntry.create({
    data: {
      storeId: parsed.data.storeId,
      productId: product.id,
      barcode: parsed.data.barcode,
      quantity: parsed.data.quantity,
      expiryDate: new Date(parsed.data.expiryDate),
    },
    include: { product: true },
  });

  return NextResponse.json({ entry }, { status: 201 });
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

  const entries = await db.inventoryEntry.findMany({
    where: {
      storeId,
      removedAt: null,
      deletedAt: null,
    },
    include: { product: true },
    orderBy: { expiryDate: "asc" },
  });

  const visible = entries.filter((entry) => expiryListVisible(entry.expiryDate, now));

  return NextResponse.json({ entries: visible });
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

  const entry = await db.inventoryEntry.updateMany({
    where: {
      id: parsed.data.entryId,
      storeId: parsed.data.storeId,
      removedAt: null,
      deletedAt: null,
    },
    data: { removedAt: new Date() },
  });

  if (entry.count === 0) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
