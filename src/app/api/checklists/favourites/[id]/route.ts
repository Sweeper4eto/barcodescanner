import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  checklistsDisabledResponse,
  requireRetailOwner,
} from "@/lib/checklist-access";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const disabled = checklistsDisabledResponse(request);
  if (disabled) return disabled;

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const owner = await requireRetailOwner(session.userId);
  if (!owner) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const favourite = await db.checklistFavourite.findUnique({ where: { id } });
  if (!favourite) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  const store = await userCanAccessRetailStore(
    session.userId,
    favourite.storeId,
  );
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  await db.checklistFavourite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
