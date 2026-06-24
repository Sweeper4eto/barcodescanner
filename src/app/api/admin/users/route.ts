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

  const users = await db.user.findMany({
    orderBy: { username: "asc" },
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
  });

  return NextResponse.json({
    users: users.map((user) => ({
      ...user,
      stores: user.storeLinks.map((link) => link.store),
      storeLinks: undefined,
    })),
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

  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
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

  const updated = await db.$transaction(async (tx) => {
    const nextUser = await tx.user.update({
      where: { id: parsed.data.userId },
      data: {
        clientId: parsed.data.clientId,
        active: parsed.data.active,
      },
    });

    if (parsed.data.storeIds) {
      const clientId = parsed.data.clientId ?? nextUser.clientId;
      if (!clientId) {
        throw new Error("NO_CLIENT");
      }

      const validStores = await tx.store.findMany({
        where: { id: { in: parsed.data.storeIds }, clientId },
        select: { id: true },
      });

      await tx.userStore.deleteMany({ where: { userId: parsed.data.userId } });
      if (validStores.length > 0) {
        await tx.userStore.createMany({
          data: validStores.map((store) => ({
            userId: parsed.data.userId,
            storeId: store.id,
          })),
        });
      }
    }

    return nextUser;
  });

  return NextResponse.json({ user: updated });
}
