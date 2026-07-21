import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";
import { requireSession } from "@/lib/auth";

export async function requireClientOwner(): Promise<
  SessionPayload & { clientId: string }
> {
  const session = await requireSession();
  if (session.role !== "USER" || !session.clientId) {
    throw new Error("FORBIDDEN");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      active: true,
      clientId: true,
      clientRole: true,
      client: { select: { active: true } },
    },
  });

  if (
    !user?.active ||
    !user.clientId ||
    user.clientRole !== "OWNER" ||
    !user.client?.active
  ) {
    throw new Error("FORBIDDEN");
  }

  return { ...session, clientId: user.clientId };
}
