import { NextResponse } from "next/server";
import { z } from "zod";
import { auditUserDeleted, auditUserUpdated } from "@/lib/audit-details";
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
          { username: { contains: q } },
          { client: { name: { contains: q } } },
          { storeLinks: { some: { store: { name: { contains: q } } } } },
        ],
      }
    : undefined;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { username: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        clientId: true,
        client: { select: { id: true, name: true } },
        storeLinks: {
          select: { store: { select: { id: true, name: true, clientId: true } } },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      stores: user.storeLinks.map((link) => link.store),
      storeLinks: undefined,
    })),
    total,
    page,
    pageSize,
    totalPages,
  });
}

const assignSchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().nullable(),
  storeIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: parsed.data.userId },
    include: {
      client: { select: { name: true } },
      storeLinks: { include: { store: { select: { name: true } } } },
    },
  });
  if (!user) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (parsed.data.clientId) {
    const client = await db.client.findUnique({
      where: { id: parsed.data.clientId },
    });
    if (!client) {
      return NextResponse.json(
        { error: apiT(request, "errors.clientNotFound") },
        { status: 404 },
      );
    }
  }

  const beforeAssignment = {
    username: user.username,
    active: user.active,
    clientName: user.client?.name ?? null,
    storeNames: user.storeLinks.map((link) => link.store.name).sort(),
  };

  if (
    parsed.data.storeIds !== undefined &&
    parsed.data.storeIds.length > 0 &&
    !parsed.data.clientId &&
    !user.clientId
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNeedsClientForStores") },
      { status: 400 },
    );
  }

  let updated;
  try {
    updated = await db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: parsed.data.userId },
        data: {
          clientId: parsed.data.clientId,
          ...(parsed.data.clientId
            ? { clientRole: user.clientRole ?? "MEMBER" }
            : parsed.data.clientId === null
              ? { clientRole: null }
              : {}),
          ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        },
      });

      if (parsed.data.storeIds !== undefined) {
        await tx.userStore.deleteMany({ where: { userId: parsed.data.userId } });

        if (parsed.data.storeIds.length > 0) {
          const clientId = parsed.data.clientId ?? nextUser.clientId;
          if (!clientId) {
            throw new Error("NO_CLIENT");
          }

          const validStores = await tx.store.findMany({
            where: { id: { in: parsed.data.storeIds }, clientId },
            select: { id: true },
          });

          if (validStores.length > 0) {
            await tx.userStore.createMany({
              data: validStores.map((store) => ({
                userId: parsed.data.userId,
                storeId: store.id,
              })),
            });
          }
        }
      }

      return nextUser;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CLIENT") {
      return NextResponse.json(
        { error: apiT(request, "errors.userNeedsClientForStores") },
        { status: 400 },
      );
    }
    throw error;
  }

  const afterUser = await db.user.findUnique({
    where: { id: parsed.data.userId },
    include: {
      client: { select: { name: true } },
      storeLinks: { include: { store: { select: { name: true } } } },
    },
  });

  if (afterUser) {
    await logAuditEvent(
      request,
      admin,
      "user_updated",
      auditUserUpdated(beforeAssignment, {
        username: afterUser.username,
        active: afterUser.active,
        clientName: afterUser.client?.name ?? null,
        storeNames: afterUser.storeLinks.map((link) => link.store.name).sort(),
      }),
    );
  }

  return NextResponse.json({ user: updated });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 400 },
    );
  }

  if (userId === admin.userId) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteSelf") },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      client: { select: { name: true } },
      storeLinks: { include: { store: { select: { name: true } } } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteAdminUser") },
      { status: 400 },
    );
  }

  await db.user.delete({ where: { id: userId } });

  await logAuditEvent(
    request,
    admin,
    "user_deleted",
    auditUserDeleted({
      username: user.username,
      active: user.active,
      clientName: user.client?.name ?? null,
      storeNames: user.storeLinks.map((link) => link.store.name).sort(),
    }),
  );

  return NextResponse.json({ ok: true });
}
