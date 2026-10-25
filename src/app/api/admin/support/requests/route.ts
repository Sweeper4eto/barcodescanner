import { requireAdminResponse } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteLocalUpload } from "@/lib/upload";
import { apiT } from "@/i18n";

const statusSchema = z.enum(["new", "in_progress", "done"]);

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = statusSchema.safeParse(statusParam ?? "new");
  const take = Math.min(
    200,
    Math.max(1, Number(searchParams.get("take") ?? "100") || 100),
  );

  const where = status.success && statusParam
    ? { status: status.data }
    : undefined;

  const rows = await db.supportRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      user: { select: { username: true } },
      store: { select: { name: true } },
      client: {
        select: {
          name: true,
          users: {
            where: { clientRole: "OWNER" },
            select: { username: true, displayName: true },
            take: 1,
          },
        },
      },
    },
  });

  const countsRaw = await db.supportRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts = {
    new: 0,
    in_progress: 0,
    done: 0,
  };
  for (const item of countsRaw) {
    if (item.status === "new") counts.new = item._count._all;
    else if (item.status === "in_progress") counts.in_progress = item._count._all;
    else if (item.status === "done") counts.done = item._count._all;
  }

  return NextResponse.json({
    requests: rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      status: row.status,
      contact: row.contact,
      message: row.message,
      documentImagePath: row.documentImagePath,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      username: row.user?.username ?? "Guest",
      storeName: row.store?.name ?? null,
      clientName: row.client?.name ?? null,
      ownerName:
        row.client?.users[0]?.displayName?.trim() ||
        row.client?.users[0]?.username ||
        row.client?.name ||
        null,
    })),
    counts,
  });
}

const idListSchema = z.array(z.string().min(1)).min(1).max(200);

const patchSchema = z
  .object({
    id: z.string().min(1).optional(),
    ids: idListSchema.optional(),
    status: statusSchema.optional(),
    adminNote: z.string().trim().max(1000).optional(),
    /** Remove the scanned document copy from disk; the ticket stays. */
    deleteDocument: z.literal(true).optional(),
  })
  .refine((value) => Boolean(value.id || value.ids?.length), {
    message: "id required",
  });

const deleteSchema = z.object({
  ids: idListSchema,
});

async function deleteTicketDocuments(ids: string[]): Promise<void> {
  const rows = await db.supportRequest.findMany({
    where: { id: { in: ids } },
    select: { documentImagePath: true },
  });
  for (const row of rows) {
    if (row.documentImagePath) {
      await deleteLocalUpload(row.documentImagePath);
    }
  }
}

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

  const ids = parsed.data.ids ?? (parsed.data.id ? [parsed.data.id] : []);
  const singleId = parsed.data.id ?? ids[0];

  if (parsed.data.deleteDocument) {
    if (!singleId) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    const existing = await db.supportRequest.findUnique({
      where: { id: singleId },
      select: { documentImagePath: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 404 },
      );
    }
    if (existing.documentImagePath) {
      await deleteLocalUpload(existing.documentImagePath);
      await db.supportRequest.update({
        where: { id: singleId },
        data: { documentImagePath: null },
      });
    }
  }

  const nextStatus = parsed.data.status;
  if (ids.length > 1 && nextStatus) {
    await db.supportRequest.updateMany({
      where: { id: { in: ids } },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === "done" ? new Date() : null,
      },
    });
    return NextResponse.json({ ok: true, ids });
  }

  const row = await db.supportRequest.update({
    where: { id: singleId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(parsed.data.adminNote !== undefined
        ? { adminNote: parsed.data.adminNote || null }
        : {}),
      ...(nextStatus === "done" ? { resolvedAt: new Date() } : {}),
      ...(nextStatus && nextStatus !== "done" ? { resolvedAt: null } : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  await deleteTicketDocuments(parsed.data.ids);
  const result = await db.supportRequest.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
