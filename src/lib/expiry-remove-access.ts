import { db } from "@/lib/db";

/**
 * Whether this user may remove (soft/hard-delete) expiry-list inventory rows.
 * Owners always can. Members follow User.canRemoveExpiry (default true).
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
  if (user.clientRole === "OWNER") return true;
  return user.canRemoveExpiry;
}
