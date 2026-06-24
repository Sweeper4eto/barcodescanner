import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      role: true,
      active: true,
      clientId: true,
      storeLinks: {
        where: { store: { active: true } },
        select: {
          store: {
            select: { id: true, name: true, active: true },
          },
        },
      },
    },
  });

  if (!user || !user.active) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      ...user,
      stores: user.storeLinks.map((link) => link.store),
      storeLinks: undefined,
    },
  });
}
