import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditInventoryAdded,
  auditInventoryMerged,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireSession } from "@/lib/auth";
import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { makeAdhocBarcode } from "@/lib/inventory-entry-display";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  expiryYmdToIso,
  normalizeExpiryDate,
} from "@/lib/inventory";
import { apiT } from "@/i18n";

const itemSchema = z.object({
  name: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  articul: z.string().optional().nullable(),
  expiryYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().positive(),
  productId: z.string().optional().nullable(),
});

const importSchema = z.object({
  storeId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(200),
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
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, parsed.data.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  let created = 0;
  let merged = 0;

  for (const item of parsed.data.items) {
    const articul = item.articul?.trim() || null;
    const name = item.name?.trim() ?? "";
    const barcode = normalizeBarcode(item.barcode ?? "") || null;
    const expiryDate = normalizeExpiryDate(new Date(expiryYmdToIso(item.expiryYmd)));
    const { start, end } = expiryDateDayBounds(expiryDate);

    let product = item.productId
      ? await db.product.findUnique({ where: { id: item.productId } })
      : null;

    if (product && barcode) {
      const ok = barcodeLookupValues(barcode).includes(product.barcode);
      if (!ok) {
        product = null;
      }
    }

    if (!product && barcode) {
      product = await db.product.findFirst({
        where: { barcode: { in: barcodeLookupValues(barcode) } },
      });
    }

    if (!product) {
      product = await db.product.create({
        data: {
          barcode: barcode || makeAdhocBarcode(),
          name,
          imagePath: null,
        },
      });
    }

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
          quantity: existing.quantity + item.quantity,
          ...(articul ? { articul } : {}),
        },
        include: { product: true },
      });
      merged += 1;
      await logAuditEvent(
        request,
        session,
        "inventory_merged",
        auditInventoryMerged({
          productName: entry.product.name,
          barcode: entry.barcode,
          addedQty: item.quantity,
          totalQty: entry.quantity,
          storeName: store.name,
          expiryDate,
        }),
      );
      continue;
    }

    const entry = await db.inventoryEntry.create({
      data: {
        storeId: parsed.data.storeId,
        productId: product.id,
        barcode: product.barcode,
        articul,
        imagePath: null,
        quantity: item.quantity,
        expiryDate,
      },
      include: { product: true },
    });
    created += 1;
    await logAuditEvent(
      request,
      session,
      "inventory_added",
      auditInventoryAdded({
        productName: entry.product.name,
        barcode: entry.barcode,
        quantity: item.quantity,
        storeName: store.name,
        expiryDate,
      }),
    );
  }

  return NextResponse.json({ created, merged, total: created + merged });
}
