import { isStoreManagerLike } from "@/lib/client-roles";
import { db } from "@/lib/db";

/**
 * Whether this user may remove (soft/hard-delete) expiry-list inventory rows.
 * Owners and store managers always can. Members follow User.canRemoveExpiry.
 */
export async function userCanRemoveExpiry(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      clientRole: true,
      canRemoveExpiry: true,
    },
  });
  if (!user) return false;
  if (isStoreManagerLike(user.clientRole)) return true;
  return user.canRemoveExpiry;
}
