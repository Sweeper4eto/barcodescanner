import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientOwner } from "@/lib/client-owner";
import {
  applyAuditRevert,
  AuditRevertError,
} from "@/lib/audit-revert";
import { auditJoin } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export const BULK_REVERT_MAX = 50;

const bodySchema = z
  .object({
    auditId: z.string().min(1).optional(),
    auditIds: z.array(z.string().min(1)).min(1).max(BULK_REVERT_MAX).optional(),
  })
  .refine(
    (value) => Boolean(value.auditId) !== Boolean(value.auditIds?.length),
    { message: "Provide auditId or auditIds" },
  );

async function ownerOrForbidden(request: Request) {
  try {
    return await requireClientOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "PAYMENT_REQUIRED") {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

function revertErrorStatus(code: string): number {
  if (code === "forbidden") return 403;
  if (code === "already_reverted" || code === "conflict") return 409;
  if (code === "missing" || code === "purged" || code === "legacy") return 404;
  if (code === "hard_deleted" || code === "not_supported" || code === "invalid") {
    return 400;
  }
  return 400;
}

function revertErrorKey(code: string) {
  if (code === "already_reverted") return "errors.revertAlreadyDone" as const;
  if (code === "conflict") return "errors.revertConflict" as const;
  if (code === "hard_deleted") return "errors.revertHardDeleted" as const;
  if (code === "purged" || code === "missing") {
    return "errors.revertMissing" as const;
  }
  if (code === "legacy" || code === "not_supported") {
    return "errors.revertNotSupported" as const;
  }
  return "errors.revertFailed" as const;
}

const auditSelect = {
  id: true,
  userId: true,
  event: true,
  details: true,
  entityType: true,
  entityId: true,
  storeId: true,
  payloadJson: true,
  revertedAt: true,
  occurredAt: true,
  user: { select: { clientId: true } },
} as const;

async function revertOne(
  request: Request,
  owner: { userId: string; username: string; clientId: string },
  row: {
    id: string;
    userId: string;
    event: string;
    details: string;
    entityType: string | null;
    entityId: string | null;
    storeId: string | null;
    payloadJson: string | null;
    revertedAt: Date | null;
    occurredAt: Date;
    user: { clientId: string | null };
  },
) {
  if (row.user.clientId !== owner.clientId) {
    throw new AuditRevertError("forbidden");
  }

  await applyAuditRevert(row, owner.clientId, owner.userId);

  await db.auditLog.update({
    where: { id: row.id },
    data: {
      revertedAt: new Date(),
      revertedByUserId: owner.userId,
    },
  });

  await logAuditEvent(
    request,
    owner,
    "activity_reverted",
    auditJoin([`reverted ${row.event}`, row.details ? row.details : null]),
    row.entityType && row.entityId
      ? {
          entityType: row.entityType as "inventory_entry" | "buy_list_entry",
          entityId: row.entityId,
          storeId: row.storeId,
          payload: {
            originalEvent: row.event,
            originalAuditId: row.id,
          },
          revertsAuditId: row.id,
        }
      : undefined,
  );
}

export async function POST(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const ids = parsed.data.auditIds?.length
    ? [...new Set(parsed.data.auditIds)]
    : [parsed.data.auditId!];
  const bulk = Boolean(parsed.data.auditIds?.length);

  const rows = await db.auditLog.findMany({
    where: { id: { in: ids } },
    select: auditSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  // Undo newest first so later changes on the same entity clear before earlier ones.
  const orderedIds = [...ids].sort((a, b) => {
    const aAt = byId.get(a)?.occurredAt?.getTime() ?? 0;
    const bAt = byId.get(b)?.occurredAt?.getTime() ?? 0;
    if (aAt !== bAt) return bAt - aAt;
    return b.localeCompare(a);
  });

  if (!bulk) {
    const row = byId.get(orderedIds[0]!);
    if (!row || row.user.clientId !== owner.clientId) {
      return NextResponse.json(
        { error: apiT(request, "errors.entryNotFound") },
        { status: 404 },
      );
    }
    try {
      await revertOne(request, owner, row);
      return NextResponse.json({ ok: true, reverted: 1, revertedIds: [row.id] });
    } catch (error) {
      if (error instanceof AuditRevertError) {
        return NextResponse.json(
          {
            error: apiT(request, revertErrorKey(error.code)),
            code: error.code,
          },
          { status: revertErrorStatus(error.code) },
        );
      }
      console.error("activity-log revert failed:", error);
      return NextResponse.json(
        { error: apiT(request, "errors.revertFailed") },
        { status: 500 },
      );
    }
  }

  const revertedIds: string[] = [];
  const failed: Array<{ auditId: string; code: string; error: string }> = [];

  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row || row.user.clientId !== owner.clientId) {
      failed.push({
        auditId: id,
        code: "missing",
        error: apiT(request, "errors.entryNotFound"),
      });
      continue;
    }
    try {
      await revertOne(request, owner, row);
      revertedIds.push(row.id);
    } catch (error) {
      if (error instanceof AuditRevertError) {
        failed.push({
          auditId: id,
          code: error.code,
          error: apiT(request, revertErrorKey(error.code)),
        });
        continue;
      }
      console.error("activity-log bulk revert failed:", error);
      failed.push({
        auditId: id,
        code: "failed",
        error: apiT(request, "errors.revertFailed"),
      });
    }
  }

  return NextResponse.json({
    ok: failed.length === 0,
    reverted: revertedIds.length,
    revertedIds,
    failed,
  });
}
