import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  auditChecklistCompleted,
  auditChecklistUncompleted,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { checklistsDisabledResponse } from "@/lib/checklist-access";
import {
  checklistCalendarYmd,
  checklistPeriodBounds,
  isChecklistTaskDueOn,
  pickChecklistPeriodCompletion,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { isLocalUploadPath } from "@/lib/upload";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  completed: z.boolean(),
  /** Defaults to today (Sofia). */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Optional: save comment / photo together with marking done. */
  comment: z.string().trim().max(2000).optional().nullable(),
  commentImagePath: z
    .string()
    .nullable()
    .optional()
    .refine(
      (value) => value == null || value === "" || isLocalUploadPath(value),
      "invalid image path",
    ),
});

export async function POST(
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

  const { id } = await context.params;
  const task = await db.checklistTask.findUnique({ where: { id } });
  if (!task || !task.active) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, task.storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const dueDate = parsed.data.dueDate ?? checklistCalendarYmd();
  if (!isChecklistTaskDueOn(task, dueDate) && parsed.data.completed) {
    // Allow undo anytime for that period; marking done only when due.
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const period = checklistPeriodBounds(task.recurrence, dueDate);

  if (
    parsed.data.comment !== undefined ||
    parsed.data.commentImagePath !== undefined
  ) {
    await db.checklistTask.update({
      where: { id },
      data: {
        ...(parsed.data.comment !== undefined
          ? { comment: parsed.data.comment?.trim() || null }
          : {}),
        ...(parsed.data.commentImagePath !== undefined
          ? {
              commentImagePath: parsed.data.commentImagePath?.trim() || null,
            }
          : {}),
      },
    });
  }

  if (parsed.data.completed) {
    // One completion per period: clear any earlier mark in the window, then
    // store today's calendar day as the completion key.
    await db.checklistCompletion.deleteMany({
      where: {
        taskId: id,
        dueDate: { gte: period.start, lte: period.end },
      },
    });
    await db.checklistCompletion.create({
      data: {
        taskId: id,
        dueDate,
        completedByUserId: session.userId,
      },
    });
    await logAuditEvent(
      request,
      session,
      "checklist_completed",
      auditChecklistCompleted({
        title: task.title,
        storeName: store.name,
        dueDate,
      }),
    );
  } else {
    await db.checklistCompletion.deleteMany({
      where: {
        taskId: id,
        dueDate: { gte: period.start, lte: period.end },
      },
    });
    await logAuditEvent(
      request,
      session,
      "checklist_uncompleted",
      auditChecklistUncompleted({
        title: task.title,
        storeName: store.name,
        dueDate,
      }),
    );
  }

  const todayYmd = checklistCalendarYmd();
  const loadPeriod = checklistPeriodBounds(task.recurrence, todayYmd);
  const row = await db.checklistTask.findUniqueOrThrow({
    where: { id },
    include: {
      completions: {
        where: {
          dueDate: { gte: loadPeriod.start, lte: loadPeriod.end },
        },
        include: {
          completedByUser: {
            select: { id: true, username: true, displayName: true },
          },
        },
      },
    },
  });
  const fav = await db.checklistFavourite.findFirst({
    where: { storeId: row.storeId, title: row.title },
    select: { id: true },
  });

  const periodCompletion = pickChecklistPeriodCompletion(
    row.completions,
    row.recurrence,
    todayYmd,
  );

  return NextResponse.json({
    task: toChecklistTaskDto({
      ...row,
      inFavourites: Boolean(fav),
      todayYmd,
      todayCompletion: periodCompletion
        ? {
            completedAt: periodCompletion.completedAt,
            completedByUser: periodCompletion.completedByUser,
          }
        : null,
    }),
  });
}
