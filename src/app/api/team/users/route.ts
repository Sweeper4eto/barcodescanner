import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { apiT } from "@/i18n";

async function ownerOrForbidden(request: Request) {
  try {
    return await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

export async function GET(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const users = await db.user.findMany({
    where: { clientId: owner.clientId, role: "USER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      active: true,
      clientRole: true,
      createdAt: true,
      storeLinks: {
        select: {
          store: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });

  const stores = await db.store.findMany({
    where: { clientId: owner.clientId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      active: user.active,
      clientRole: user.clientRole,
      createdAt: user.createdAt.toISOString(),
      stores: user.storeLinks.map((link) => link.store),
    })),
    stores,
  });
}

const createSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  storeIds: z.array(z.string().min(1)).default([]),
});

export async function POST(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const username = parsed.data.username.trim().toLowerCase();
  if (username.length < 3) {
    return NextResponse.json(
      { error: apiT(request, "auth.usernameTooShort") },
      { status: 400 },
    );
  }
  if (parsed.data.password.length < 6) {
    return NextResponse.json(
      { error: apiT(request, "auth.passwordTooShort") },
      { status: 400 },
    );
  }
  if (parsed.data.password.length > 72) {
    return NextResponse.json(
      { error: apiT(request, "auth.passwordTooLong") },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: apiT(request, "auth.usernameTaken") },
      { status: 400 },
    );
  }

  const clientStores = await db.store.findMany({
    where: { clientId: owner.clientId, active: true },
    select: { id: true },
  });
  const allowed = new Set(clientStores.map((store) => store.id));
  const storeIds = parsed.data.storeIds.filter((id) => allowed.has(id));
  if (storeIds.length === 0 && clientStores[0]) {
    storeIds.push(clientStores[0].id);
  }

  const user = await db.user.create({
    data: {
      username,
      passwordHash: await hashPassword(parsed.data.password),
      role: "USER",
      clientRole: "MEMBER",
      clientId: owner.clientId,
      storeLinks: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    select: {
      id: true,
      username: true,
      active: true,
      clientRole: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      active: user.active,
      clientRole: user.clientRole,
      stores: user.storeLinks.map((link) => link.store),
    },
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  active: z.boolean().optional(),
  storeIds: z.array(z.string().min(1)).optional(),
});

export async function PATCH(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const target = await db.user.findFirst({
    where: {
      id: parsed.data.userId,
      clientId: owner.clientId,
      role: "USER",
    },
    select: { id: true, clientRole: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (target.id === owner.userId && parsed.data.active === false) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeactivateSelf") },
      { status: 400 },
    );
  }

  if (target.clientRole === "OWNER" && parsed.data.active === false) {
    const owners = await db.user.count({
      where: {
        clientId: owner.clientId,
        clientRole: "OWNER",
        active: true,
      },
    });
    if (owners <= 1) {
      return NextResponse.json(
        { error: apiT(request, "errors.cannotDeactivateLastOwner") },
        { status: 400 },
      );
    }
  }

  if (parsed.data.storeIds) {
    const clientStores = await db.store.findMany({
      where: { clientId: owner.clientId },
      select: { id: true },
    });
    const allowed = new Set(clientStores.map((store) => store.id));
    const storeIds = parsed.data.storeIds.filter((id) => allowed.has(id));

    await db.$transaction([
      db.userStore.deleteMany({ where: { userId: target.id } }),
      db.userStore.createMany({
        data: storeIds.map((storeId) => ({ userId: target.id, storeId })),
      }),
      ...(parsed.data.active !== undefined
        ? [
            db.user.update({
              where: { id: target.id },
              data: { active: parsed.data.active },
            }),
          ]
        : []),
    ]);
  } else if (parsed.data.active !== undefined) {
    await db.user.update({
      where: { id: target.id },
      data: { active: parsed.data.active },
    });
  }

  const updated = await db.user.findUniqueOrThrow({
    where: { id: target.id },
    select: {
      id: true,
      username: true,
      active: true,
      clientRole: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      active: updated.active,
      clientRole: updated.clientRole,
      stores: updated.storeLinks.map((link) => link.store),
    },
  });
}
