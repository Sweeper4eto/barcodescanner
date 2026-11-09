import { db } from "@/lib/db";

export async function requireRetailOwner(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      active: true,
      clientRole: true,
      client: { select: { active: true, homeUser: true } },
    },
  });
  if (
    !user?.active ||
    user.clientRole !== "OWNER" ||
    !user.client?.active ||
    user.client.homeUser
  ) {
    return null;
  }
  return user;
}

export async function isRetailOwner(userId: string): Promise<boolean> {
  return Boolean(await requireRetailOwner(userId));
}
