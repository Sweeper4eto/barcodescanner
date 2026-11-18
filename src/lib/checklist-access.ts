import { NextResponse } from "next/server";
import { CHECKLISTS_FEATURE_ENABLED } from "@/lib/checklist";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export type ChecklistAssigneeOption = {
  id: string;
  username: string;
  displayName: string | null;
};

/** Active users linked to this store (owners + staff), for assignee picker. */
export async function listChecklistAssigneeOptions(
  storeId: string,
): Promise<ChecklistAssigneeOption[]> {
  const links = await db.userStore.findMany({
    where: {
      storeId,
      user: { active: true },
    },
    select: {
      user: {
        select: { id: true, username: true, displayName: true },
      },
    },
    orderBy: { user: { username: "asc" } },
  });
  const seen = new Set<string>();
  const out: ChecklistAssigneeOption[] = [];
  for (const link of links) {
    if (seen.has(link.user.id)) continue;
    seen.add(link.user.id);
    out.push(link.user);
  }
  out.sort((a, b) => {
    const aName = (a.displayName?.trim() || a.username).toLowerCase();
    const bName = (b.displayName?.trim() || b.username).toLowerCase();
    return aName.localeCompare(bName);
  });
  return out;
}

/** Null = Everyone. Otherwise must be an active user linked to the store. */
export async function resolveChecklistAssigneeUserId(
  storeId: string,
  assigneeUserId: string | null | undefined,
): Promise<string | null | { error: "invalid_assignee" }> {
  if (assigneeUserId == null || assigneeUserId === "" || assigneeUserId === "everyone") {
    return null;
  }
  const link = await db.userStore.findUnique({
    where: {
      userId_storeId: { userId: assigneeUserId, storeId },
    },
    select: { user: { select: { active: true } } },
  });
  if (!link?.user.active) return { error: "invalid_assignee" };
  return assigneeUserId;
}

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
