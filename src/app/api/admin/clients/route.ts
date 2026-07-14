import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit-log";
import { auditClientCreated, auditClientDeleted, auditClientUpdated } from "@/lib/audit-details";
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

  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { additionalInfo: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { stores: true, users: true } },
    },
  });

  return NextResponse.json({ clients });
}

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  monthlyFeePerStore: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  homeUser: z.boolean().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = clientSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const client = await db.client.create({ data: parsed.data });
  await logAuditEvent(request, admin, "client_created", auditClientCreated(client));
  return NextResponse.json({ client }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  monthlyFeePerStore: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  homeUser: z.boolean().optional(),
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
  const before = await db.client.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }
  const client = await db.client.update({ where: { id }, data });
  await logAuditEvent(request, admin, "client_updated", auditClientUpdated(before, client));
  return NextResponse.json({ client });
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

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  await db.client.delete({ where: { id } });
  await logAuditEvent(request, admin, "client_deleted", auditClientDeleted(existing));
  return NextResponse.json({ ok: true });
}
