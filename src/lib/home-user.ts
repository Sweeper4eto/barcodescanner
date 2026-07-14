import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";

export async function userCanAccessHomeStore(userId: string, storeId: string) {
  const link = await db.userStore.findUnique({
    where: { userId_storeId: { userId, storeId } },
    include: {
      store: { include: { client: true } },
      user: { include: { client: true } },
    },
  });

  if (!link?.store.active) return null;
  if (!link.user.client?.homeUser || !link.user.client.active) return null;
  if (link.store.clientId !== link.user.clientId) return null;

  return link.store;
}
