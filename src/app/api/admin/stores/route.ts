import { NextResponse } from "next/server";
import { z } from "zod";
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
  const clientId = searchParams.get("clientId");

  if (clientId) {
    const stores = await db.store.findMany({
      where: { clientId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ stores });
  }

  return NextResponse.json(
    { error: apiT(request, "errors.missingClientId") },
    { status: 400 },
  );
}

const storeSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = storeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await db.store.create({ data: parsed.data });
  return NextResponse.json({ store }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  additionalInfo: z.string().optional(),
  active: z.boolean().optional(),
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
  const store = await db.store.update({ where: { id }, data });
  return NextResponse.json({ store });
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

  await db.store.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
