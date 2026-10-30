import { NextResponse } from "next/server";
import { clientRequiresPayment } from "@/lib/app-config";
import { db } from "@/lib/db";
import { parseScheduleAccess } from "@/lib/schedule";
import { clearSessionCookie, getSession } from "@/lib/session";

export async function GET(request: Request) {
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
      canRemoveExpiry: true,
      mustChangePassword: true,
      client: {
        select: {
          active: true,
          homeUser: true,
          scheduleEnabled: true,
          scheduleAccess: true,
        },
      },
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

  if (user.role === "USER" && user.clientId && !user.client?.active) {
    await clearSessionCookie(request);
    return NextResponse.json({ user: null });
  }

  if (
    user.role === "USER" &&
    user.clientId &&
    (await clientRequiresPayment(user.clientId))
  ) {
    await clearSessionCookie(request);
    return NextResponse.json({
      user: null,
      code: "PAYMENT_REQUIRED",
    });
  }

  const { client, storeLinks, ...rest } = user;
  const scheduleEnabled = client?.scheduleEnabled ?? true;
  const canRemoveExpiry =
    rest.clientRole === "OWNER" || rest.canRemoveExpiry;

  return NextResponse.json({
    user: {
      ...rest,
      homeUser: client?.homeUser ?? false,
      scheduleEnabled,
      scheduleAccess: scheduleEnabled
        ? parseScheduleAccess(client?.scheduleAccess)
        : "disabled",
      canRemoveExpiry,
      stores: storeLinks.map((link) => link.store),
    },
  });
}
