import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  checklistCalendarYmd,
  isChecklistTaskDueOn,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  completed: z.boolean(),
  /** Defaults to today (Sofia). */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
  if (
    !isChecklistTaskDueOn(task, dueDate) &&
    parsed.data.completed
  ) {
    // Allow undo anytime for that dueDate; marking done only when due.
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  if (parsed.data.completed) {
    await db.checklistCompletion.upsert({
      where: { taskId_dueDate: { taskId: id, dueDate } },
      create: {
        taskId: id,
        dueDate,
        completedByUserId: session.userId,
      },
      update: {
        completedAt: new Date(),
        completedByUserId: session.userId,
      },
    });
  } else {
    await db.checklistCompletion.deleteMany({
      where: { taskId: id, dueDate },
    });
  }

  const todayYmd = checklistCalendarYmd();
  const row = await db.checklistTask.findUniqueOrThrow({
    where: { id },
    include: {
      completions: {
        where: { dueDate: todayYmd },
        take: 1,
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

  return NextResponse.json({
    task: toChecklistTaskDto({
      ...row,
      inFavourites: Boolean(fav),
      todayYmd,
      todayCompletion: row.completions[0]
        ? {
            completedAt: row.completions[0].completedAt,
            completedByUser: row.completions[0].completedByUser,
          }
        : null,
    }),
  });
}
