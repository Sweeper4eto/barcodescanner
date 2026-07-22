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
      clientRole: true,
      client: { select: { homeUser: true } },
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

  const { client, storeLinks, ...rest } = user;

  return NextResponse.json({
    user: {
      ...rest,
      homeUser: client?.homeUser ?? false,
      stores: storeLinks.map((link) => link.store),
    },
  });
}
