import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  checklistsDisabledResponse,
  requireRetailOwner,
} from "@/lib/checklist-access";
import {
  checklistCalendarYmd,
  checklistPeriodBounds,
  normalizeChecklistFields,
  pickChecklistPeriodCompletion,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

const ownerPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
  recurrence: z.enum(["daily", "weekly", "monthly", "once"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  weekday: z.number().int().min(0).max(6).optional().nullable(),
  monthDay: z.number().int().min(1).max(31).optional().nullable(),
  active: z.boolean().optional(),
});

/** Staff may only update the free-text comment. */
const staffCommentPatchSchema = z.object({
  comment: z.string().trim().max(2000).nullable(),
});

async function loadTaskForStoreAccess(taskId: string, userId: string) {
  const task = await db.checklistTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "not_found" as const };
  const store = await userCanAccessRetailStore(userId, task.storeId);
  if (!store) return { error: "forbidden" as const };
  const owner = await requireRetailOwner(userId);
  return { task, isOwner: Boolean(owner) };
}

async function taskResponse(taskId: string) {
  const row = await db.checklistTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      completions: {
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
  const todayYmd = checklistCalendarYmd();
  const period = checklistPeriodBounds(row.recurrence, todayYmd);
  const periodCompletions = row.completions.filter(
    (c) => c.dueDate >= period.start && c.dueDate <= period.end,
  );
  const periodCompletion = pickChecklistPeriodCompletion(
    periodCompletions,
    row.recurrence,
    todayYmd,
  );
  return {
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
  };
}

export async function PATCH(
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
  const loaded = await loadTaskForStoreAccess(id, session.userId);
  if ("error" in loaded) {
    const status = loaded.error === "not_found" ? 404 : 403;
    return NextResponse.json(
      {
        error: apiT(
          request,
          loaded.error === "not_found"
            ? "errors.entryNotFound"
            : "errors.forbidden",
        ),
      },
      { status },
    );
  }

  const json = await request.json().catch(() => null);

  if (!loaded.isOwner) {
    const parsed = staffCommentPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.forbidden") },
        { status: 403 },
      );
    }
    await db.checklistTask.update({
      where: { id },
      data: {
        comment: parsed.data.comment?.trim() || null,
      },
    });
    return NextResponse.json(await taskResponse(id));
  }

  const parsed = ownerPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const fields = normalizeChecklistFields({
    recurrence: (data.recurrence ??
      loaded.task.recurrence) as "daily" | "weekly" | "monthly" | "once",
    dueDate:
      data.dueDate !== undefined ? data.dueDate : loaded.task.dueDate,
    weekday:
      data.weekday !== undefined ? data.weekday : loaded.task.weekday,
    monthDay:
      data.monthDay !== undefined ? data.monthDay : loaded.task.monthDay,
  });
  if ("error" in fields) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  await db.checklistTask.update({
    where: { id },
    data: {
      title: data.title?.trim(),
      note:
        data.note !== undefined ? data.note?.trim() || null : undefined,
      comment:
        data.comment !== undefined
          ? data.comment?.trim() || null
          : undefined,
      recurrence: fields.recurrence,
      dueDate: fields.dueDate,
      weekday: fields.weekday,
      monthDay: fields.monthDay,
      active: data.active,
    },
  });

  return NextResponse.json(await taskResponse(id));
}

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

  const { id } = await context.params;
  const loaded = await loadTaskForStoreAccess(id, session.userId);
  if ("error" in loaded) {
    const status = loaded.error === "not_found" ? 404 : 403;
    return NextResponse.json(
      {
        error: apiT(
          request,
          loaded.error === "not_found"
            ? "errors.entryNotFound"
            : "errors.forbidden",
        ),
      },
      { status },
    );
  }
  if (!loaded.isOwner) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  await db.checklistTask.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
