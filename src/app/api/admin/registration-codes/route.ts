import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import { createRegistrationCode } from "@/lib/registration-codes";

function serialize(row: {
  id: string;
  code: string;
  createdAt: Date;
  usedAt: Date | null;
  usedByUsername: string;
  note: string;
  createdBy: { username: string };
}) {
  return {
    id: row.id,
    code: row.code,
    createdAt: row.createdAt.toISOString(),
    createdByUsername: row.createdBy.username,
    usedAt: row.usedAt?.toISOString() ?? null,
    usedByUsername: row.usedByUsername || null,
    note: row.note,
  };
}

export async function GET(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const rows = await db.registrationCode.findMany({
    orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      createdBy: { select: { username: true } },
    },
  });

  return NextResponse.json({
    codes: rows.map(serialize),
  });
}

const createSchema = z.object({
  note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const json = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  try {
    const created = await createRegistrationCode({
      createdByUserId: session.userId,
      note: parsed.data.note,
    });
    const row = await db.registrationCode.findUniqueOrThrow({
      where: { id: created.id },
      include: { createdBy: { select: { username: true } } },
    });
    return NextResponse.json({ code: serialize(row) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "admin.registrationCodeGenerateFailed") },
      { status: 500 },
    );
  }
}
