import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isOnlyClientOwner,
  listManagedStoreIds,
  requireStoreManagerOrOwner,
} from "@/lib/client-owner";
import { isAccountOwner, isStoreManagerLike } from "@/lib/client-roles";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import {
  parseUsernameChange,
  syncDenormalizedUsername,
  usernameIsTaken,
} from "@/lib/rename-username";
import { normalizeUsername, validateUsername } from "@/lib/register-validation";
import { apiT } from "@/i18n";

const clientRoleSchema = z.enum(["OWNER", "STORE_MANAGER", "MEMBER"]);

async function managerOrForbidden(request: Request) {
  try {
    return await requireStoreManagerOrOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "PAYMENT_REQUIRED") {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 80) : null;
}

export async function GET(request: Request) {
  const actor = await managerOrForbidden(request);
  if (actor instanceof NextResponse) return actor;

  const managedStoreIds = await listManagedStoreIds(
    actor.userId,
    actor.clientId,
    actor.clientRole,
  );

  const users = await db.user.findMany({
    where: { clientId: actor.clientId, role: "USER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      active: true,
      clientRole: true,
      canRemoveExpiry: true,
      storeLinks: {
        select: {
          store: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });

  const managedSet = new Set(managedStoreIds);
  const visibleUsers = isAccountOwner(actor.clientRole)
    ? users
    : users.filter((user) => {
        if (user.id === actor.userId) return true;
        return user.storeLinks.some((link) => managedSet.has(link.store.id));
      });

  const stores = await db.store.findMany({
    where: isAccountOwner(actor.clientRole)
      ? { clientId: actor.clientId }
      : { clientId: actor.clientId, id: { in: managedStoreIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json({
    actorClientRole: actor.clientRole,
    users: visibleUsers.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      active: user.active,
      clientRole: user.clientRole,
      canRemoveExpiry: user.canRemoveExpiry,
      stores: user.storeLinks.map((link) => link.store),
    })),
    stores,
  });
}

const createSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().max(80).optional().nullable(),
  password: z.string().min(1),
  storeIds: z.array(z.string().min(1)).default([]),
  clientRole: clientRoleSchema.optional(),
  canRemoveExpiry: z.boolean().optional(),
});

export async function POST(request: Request) {
  const actor = await managerOrForbidden(request);
  if (actor instanceof NextResponse) return actor;

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const username = normalizeUsername(parsed.data.username);
  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json(
      { error: apiT(request, usernameError) },
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

  const requestedRole = parsed.data.clientRole ?? "MEMBER";
  if (!isAccountOwner(actor.clientRole)) {
    if (requestedRole !== "MEMBER") {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
  }

  const managedStoreIds = await listManagedStoreIds(
    actor.userId,
    actor.clientId,
    actor.clientRole,
  );
  const allowed = new Set(managedStoreIds);
  const storeIds = parsed.data.storeIds.filter((id) => allowed.has(id));
  if (storeIds.length === 0 && managedStoreIds[0]) {
    storeIds.push(managedStoreIds[0]);
  }
  if (storeIds.length === 0) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const clientRole = requestedRole;
  const user = await db.user.create({
    data: {
      username,
      displayName: normalizeDisplayName(parsed.data.displayName),
      passwordHash: await hashPassword(parsed.data.password),
      mustChangePassword: true,
      role: "USER",
      clientRole,
      canRemoveExpiry: isStoreManagerLike(clientRole)
        ? true
        : (parsed.data.canRemoveExpiry ?? true),
      clientId: actor.clientId,
      storeLinks: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      active: true,
      clientRole: true,
      canRemoveExpiry: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      active: user.active,
      clientRole: user.clientRole,
      canRemoveExpiry: user.canRemoveExpiry,
      stores: user.storeLinks.map((link) => link.store),
    },
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).optional(),
  displayName: z.string().max(80).optional().nullable(),
  password: z.string().min(1).optional(),
  confirmPassword: z.string().optional(),
  active: z.boolean().optional(),
  storeIds: z.array(z.string().min(1)).optional(),
  clientRole: clientRoleSchema.optional(),
  canRemoveExpiry: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const actor = await managerOrForbidden(request);
  if (actor instanceof NextResponse) return actor;

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
      clientId: actor.clientId,
      role: "USER",
    },
    select: {
      id: true,
      clientRole: true,
      username: true,
      storeLinks: { select: { storeId: true } },
    },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  const managedStoreIds = await listManagedStoreIds(
    actor.userId,
    actor.clientId,
    actor.clientRole,
  );
  const managedSet = new Set(managedStoreIds);

  if (!isAccountOwner(actor.clientRole)) {
    const overlaps =
      target.id === actor.userId ||
      target.storeLinks.some((link) => managedSet.has(link.storeId));
    if (!overlaps) {
      return NextResponse.json(
        { error: apiT(request, "errors.userNotFound") },
        { status: 404 },
      );
    }
    if (isStoreManagerLike(target.clientRole) && target.id !== actor.userId) {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
    if (
      parsed.data.clientRole !== undefined &&
      parsed.data.clientRole !== "MEMBER"
    ) {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
  }

  if (target.id === actor.userId && parsed.data.active === false) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeactivateSelf") },
      { status: 400 },
    );
  }

  if (
    parsed.data.clientRole !== undefined &&
    parsed.data.clientRole !== "OWNER" &&
    target.clientRole === "OWNER" &&
    (await isOnlyClientOwner(target.id, actor.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotRemoveLastOwner") },
      { status: 400 },
    );
  }

  if (
    target.clientRole === "OWNER" &&
    parsed.data.active === false &&
    (await isOnlyClientOwner(target.id, actor.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeactivateLastOwner") },
      { status: 400 },
    );
  }

  let nextUsername: string | undefined;
  if (parsed.data.username !== undefined) {
    const usernameChange = parseUsernameChange(
      parsed.data.username,
      target.username,
    );
    if (!usernameChange.ok) {
      return NextResponse.json(
        { error: apiT(request, usernameChange.errorKey) },
        { status: 400 },
      );
    }
    if (
      usernameChange.username &&
      (await usernameIsTaken(db, usernameChange.username, target.id))
    ) {
      return NextResponse.json(
        { error: apiT(request, "auth.usernameTaken") },
        { status: 400 },
      );
    }
    if (usernameChange.username) nextUsername = usernameChange.username;
  }

  let nextPasswordHash: string | undefined;
  if (parsed.data.password !== undefined && parsed.data.password.length > 0) {
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
    if (parsed.data.password !== (parsed.data.confirmPassword ?? "")) {
      return NextResponse.json(
        { error: apiT(request, "auth.passwordMismatch") },
        { status: 400 },
      );
    }
    nextPasswordHash = await hashPassword(parsed.data.password);
  }

  if (parsed.data.storeIds) {
    const storeIds = parsed.data.storeIds.filter((id) => managedSet.has(id));
    if (!isAccountOwner(actor.clientRole)) {
      // Keep links outside manager scope; replace only managed stores.
      const keepOutside = target.storeLinks
        .map((l) => l.storeId)
        .filter((id) => !managedSet.has(id));
      const nextIds = [...new Set([...keepOutside, ...storeIds])];
      await db.$transaction([
        db.userStore.deleteMany({ where: { userId: target.id } }),
        db.userStore.createMany({
          data: nextIds.map((storeId) => ({ userId: target.id, storeId })),
        }),
      ]);
    } else {
      await db.$transaction([
        db.userStore.deleteMany({ where: { userId: target.id } }),
        db.userStore.createMany({
          data: storeIds.map((storeId) => ({ userId: target.id, storeId })),
        }),
      ]);
    }
  }

  const updateData: {
    username?: string;
    displayName?: string | null;
    passwordHash?: string;
    mustChangePassword?: boolean;
    active?: boolean;
    clientRole?: "OWNER" | "STORE_MANAGER" | "MEMBER";
    canRemoveExpiry?: boolean;
  } = {};
  if (nextUsername !== undefined) updateData.username = nextUsername;
  if (parsed.data.displayName !== undefined) {
    updateData.displayName = normalizeDisplayName(parsed.data.displayName);
  }
  if (nextPasswordHash !== undefined) {
    updateData.passwordHash = nextPasswordHash;
    updateData.mustChangePassword = true;
  }
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  const nextRole = parsed.data.clientRole ?? target.clientRole;
  if (parsed.data.clientRole !== undefined) {
    updateData.clientRole = parsed.data.clientRole;
  }
  if (isStoreManagerLike(nextRole)) {
    updateData.canRemoveExpiry = true;
  } else if (parsed.data.canRemoveExpiry !== undefined) {
    updateData.canRemoveExpiry = parsed.data.canRemoveExpiry;
  }

  if (Object.keys(updateData).length > 0) {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: updateData,
      });
      if (nextUsername) {
        await syncDenormalizedUsername(tx, target.id, nextUsername);
      }
    });
  }

  const updated = await db.user.findUniqueOrThrow({
    where: { id: target.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      active: true,
      clientRole: true,
      canRemoveExpiry: true,
      storeLinks: {
        select: { store: { select: { id: true, name: true, active: true } } },
      },
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      active: updated.active,
      clientRole: updated.clientRole,
      canRemoveExpiry: updated.canRemoveExpiry,
      stores: updated.storeLinks.map((link) => link.store),
    },
  });
}

const deleteSchema = z.object({
  userId: z.string().min(1),
});

export async function DELETE(request: Request) {
  const actor = await managerOrForbidden(request);
  if (actor instanceof NextResponse) return actor;

  const json = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const target = await db.user.findFirst({
    where: {
      id: parsed.data.userId,
      clientId: actor.clientId,
      role: "USER",
    },
    select: {
      id: true,
      clientRole: true,
      storeLinks: { select: { storeId: true } },
    },
  });
  if (!target) {
    return NextResponse.json(
      { error: apiT(request, "errors.userNotFound") },
      { status: 404 },
    );
  }

  if (target.id === actor.userId) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteSelf") },
      { status: 400 },
    );
  }

  if (!isAccountOwner(actor.clientRole)) {
    const managedStoreIds = await listManagedStoreIds(
      actor.userId,
      actor.clientId,
      actor.clientRole,
    );
    const managedSet = new Set(managedStoreIds);
    const overlaps = target.storeLinks.some((link) =>
      managedSet.has(link.storeId),
    );
    if (!overlaps || isStoreManagerLike(target.clientRole)) {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
  }

  if (
    target.clientRole === "OWNER" &&
    (await isOnlyClientOwner(target.id, actor.clientId))
  ) {
    return NextResponse.json(
      { error: apiT(request, "errors.cannotDeleteLastOwner") },
      { status: 400 },
    );
  }

  await db.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true });
}
