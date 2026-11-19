import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";
import { requireSession } from "@/lib/auth";
import { isAccountOwner, isStoreManagerLike } from "@/lib/client-roles";

export async function countClientOwners(clientId: string): Promise<number> {
  return db.user.count({
    where: { clientId, clientRole: "OWNER", active: true },
  });
}

export async function isOnlyClientOwner(userId: string, clientId: string): Promise<boolean> {
  const owners = await db.user.findMany({
    where: { clientId, clientRole: "OWNER", active: true },
    select: { id: true },
  });
  return owners.length === 1 && owners[0]?.id === userId;
}

async function loadRetailUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      clientId: true,
      clientRole: true,
      client: { select: { active: true, homeUser: true } },
    },
  });
}

/** Account owner only (Billing, schedule-access, activity revert, etc.). */
export async function requireClientOwner(options?: {
  allowWhenPaymentLocked?: boolean;
}): Promise<SessionPayload & { clientId: string }> {
  const session = await requireSession({
    allowWhenPaymentLocked: options?.allowWhenPaymentLocked,
  });
  if (session.role !== "USER" || !session.clientId) {
    throw new Error("FORBIDDEN");
  }

  const user = await loadRetailUser(session.userId);

  if (
    !user?.active ||
    !user.clientId ||
    !isAccountOwner(user.clientRole) ||
    !user.client?.active
  ) {
    throw new Error("FORBIDDEN");
  }

  return { ...session, clientId: user.clientId };
}

/**
 * Account owner or store manager (Team, Analytics, schedule edit).
 * Store managers are still limited to their UserStore links elsewhere.
 */
export async function requireStoreManagerOrOwner(options?: {
  allowWhenPaymentLocked?: boolean;
}): Promise<
  SessionPayload & {
    clientId: string;
    clientRole: "OWNER" | "STORE_MANAGER";
  }
> {
  const session = await requireSession({
    allowWhenPaymentLocked: options?.allowWhenPaymentLocked,
  });
  if (session.role !== "USER" || !session.clientId) {
    throw new Error("FORBIDDEN");
  }

  const user = await loadRetailUser(session.userId);

  if (
    !user?.active ||
    !user.clientId ||
    !isStoreManagerLike(user.clientRole) ||
    !user.client?.active ||
    user.client.homeUser
  ) {
    throw new Error("FORBIDDEN");
  }

  const clientRole =
    user.clientRole === "STORE_MANAGER" ? "STORE_MANAGER" : "OWNER";

  return { ...session, clientId: user.clientId, clientRole };
}

/** Store ids the user may manage (all client stores for owners). */
export async function listManagedStoreIds(
  userId: string,
  clientId: string,
  clientRole: string | null | undefined,
): Promise<string[]> {
  if (isAccountOwner(clientRole)) {
    const stores = await db.store.findMany({
      where: { clientId, active: true },
      select: { id: true },
    });
    return stores.map((s) => s.id);
  }
  const links = await db.userStore.findMany({
    where: {
      userId,
      store: { clientId, active: true },
    },
    select: { storeId: true },
  });
  return links.map((l) => l.storeId);
}
