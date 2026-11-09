import { NextResponse } from "next/server";
import { CHECKLISTS_FEATURE_ENABLED } from "@/lib/checklist";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

/** Returns a 404 response when checklists are globally disabled. */
export function checklistsDisabledResponse(request: Request) {
  if (CHECKLISTS_FEATURE_ENABLED) return null;
  return NextResponse.json(
    { error: apiT(request, "errors.entryNotFound") },
    { status: 404 },
  );
}

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
