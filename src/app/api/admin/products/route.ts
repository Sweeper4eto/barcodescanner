import { NextResponse } from "next/server";
import { z } from "zod";
import {
  auditProductDeleted,
  auditProductUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20),
  );

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { barcode: { contains: q } },
          { barcode: q },
        ],
      }
    : undefined;

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { inventory: true } } },
    }),
    db.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    products,
    total,
    page,
    pageSize,
    totalPages,
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  imagePath: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { id, ...data } = parsed.data;

  if (data.barcode) {
    const existing = await db.product.findFirst({
      where: { barcode: data.barcode, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.productExists") },
        { status: 409 },
      );
    }
  }

  const before = await db.product.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  const product = await db.product.update({ where: { id }, data });

  await logAuditEvent(
    request,
    admin,
    "product_updated",
    auditProductUpdated(before, product),
  );

  return NextResponse.json({ product });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 400 },
    );
  }

  const product = await db.product.findUnique({
    where: { id },
    include: { _count: { select: { inventory: true } } },
  });
  if (!product) {
    return NextResponse.json(
      { error: apiT(request, "errors.productNotFound") },
      { status: 404 },
    );
  }

  if (product._count.inventory > 0) {
    return NextResponse.json(
      { error: apiT(request, "errors.productHasInventory") },
      { status: 409 },
    );
  }

  await db.product.delete({ where: { id } });
  await logAuditEvent(request, admin, "product_deleted", auditProductDeleted(product));

  return NextResponse.json({ ok: true });
}
