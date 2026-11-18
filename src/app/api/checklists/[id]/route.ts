import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  auditChecklistRemoved,
  auditChecklistUpdated,
  auditFieldChange,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import {
  checklistsDisabledResponse,
  requireRetailOwner,
  resolveChecklistAssigneeUserId,
} from "@/lib/checklist-access";
import {
  canViewChecklistTask,
  checklistCalendarYmd,
  checklistPeriodBounds,
  normalizeChecklistFields,
  pickChecklistPeriodCompletion,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { isLocalUploadPath } from "@/lib/upload";
import { apiT } from "@/i18n";

const commentImagePathSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (value) => value == null || value === "" || isLocalUploadPath(value),
    "invalid image path",
  );

const ownerPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  note: z.string().trim().max(2000).optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
  commentImagePath: commentImagePathSchema,
  recurrence: z.enum(["daily", "weekly", "monthly", "once"]).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  weekday: z.number().int().min(0).max(6).optional().nullable(),
  monthDay: z.number().int().min(1).max(31).optional().nullable(),
  active: z.boolean().optional(),
  assigneeUserId: z.string().min(1).nullable().optional(),
});

/** Staff may only update the free-text comment (+ optional photo). */
const staffCommentPatchSchema = z.object({
  comment: z.string().trim().max(2000).nullable(),
  commentImagePath: commentImagePathSchema,
});

async function loadTaskForStoreAccess(taskId: string, userId: string) {
  const task = await db.checklistTask.findUnique({ where: { id: taskId } });
  if (!task) return { error: "not_found" as const };
  const store = await userCanAccessRetailStore(userId, task.storeId);
  if (!store) return { error: "forbidden" as const };
  const owner = await requireRetailOwner(userId);
  const isOwner = Boolean(owner);
  if (!canViewChecklistTask(task, userId, isOwner)) {
    return { error: "not_found" as const };
  }
  return { task, store, isOwner };
}

async function taskResponse(taskId: string) {
  const row = await db.checklistTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      assigneeUser: {
        select: { id: true, username: true, displayName: true },
      },
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
    const nextComment = parsed.data.comment?.trim() || null;
    const nextImage =
      parsed.data.commentImagePath !== undefined
        ? parsed.data.commentImagePath?.trim() || null
        : loaded.task.commentImagePath;
    await db.checklistTask.update({
      where: { id },
      data: {
        comment: nextComment,
        ...(parsed.data.commentImagePath !== undefined
          ? { commentImagePath: nextImage }
          : {}),
      },
    });
    const changes = [
      auditFieldChange("comment", loaded.task.comment, nextComment),
      parsed.data.commentImagePath !== undefined
        ? auditFieldChange(
            "commentImage",
            loaded.task.commentImagePath,
            nextImage,
          )
        : null,
    ];
    if (changes.some(Boolean)) {
      await logAuditEvent(
        request,
        session,
        "checklist_updated",
        auditChecklistUpdated({
          title: loaded.task.title,
          storeName: loaded.store.name,
          changes,
        }),
      );
    }
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

  const nextTitle = data.title?.trim() ?? loaded.task.title;
  const nextNote =
    data.note !== undefined ? data.note?.trim() || null : loaded.task.note;
  const nextComment =
    data.comment !== undefined
      ? data.comment?.trim() || null
      : loaded.task.comment;
  const nextImage =
    data.commentImagePath !== undefined
      ? data.commentImagePath?.trim() || null
      : loaded.task.commentImagePath;
  let nextAssignee = loaded.task.assigneeUserId;
  if (data.assigneeUserId !== undefined) {
    const assigneeResolved = await resolveChecklistAssigneeUserId(
      loaded.task.storeId,
      data.assigneeUserId,
    );
    if (assigneeResolved && typeof assigneeResolved === "object") {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }
    nextAssignee = assigneeResolved;
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
      commentImagePath:
        data.commentImagePath !== undefined
          ? data.commentImagePath?.trim() || null
          : undefined,
      recurrence: fields.recurrence,
      dueDate: fields.dueDate,
      weekday: fields.weekday,
      monthDay: fields.monthDay,
      active: data.active,
      ...(data.assigneeUserId !== undefined
        ? { assigneeUserId: nextAssignee }
        : {}),
    },
  });

  const changes = [
    auditFieldChange("title", loaded.task.title, nextTitle),
    auditFieldChange("note", loaded.task.note, nextNote),
    auditFieldChange("comment", loaded.task.comment, nextComment),
    auditFieldChange(
      "commentImage",
      loaded.task.commentImagePath,
      nextImage,
    ),
    auditFieldChange("recurrence", loaded.task.recurrence, fields.recurrence),
    auditFieldChange("dueDate", loaded.task.dueDate, fields.dueDate),
    auditFieldChange(
      "weekday",
      loaded.task.weekday,
      fields.weekday,
    ),
    auditFieldChange(
      "monthDay",
      loaded.task.monthDay,
      fields.monthDay,
    ),
    auditFieldChange(
      "active",
      loaded.task.active,
      data.active ?? loaded.task.active,
    ),
    auditFieldChange(
      "assignee",
      loaded.task.assigneeUserId,
      nextAssignee,
    ),
  ];
  if (changes.some(Boolean)) {
    await logAuditEvent(
      request,
      session,
      "checklist_updated",
      auditChecklistUpdated({
        title: nextTitle,
        storeName: loaded.store.name,
        changes,
      }),
    );
  }

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

  await logAuditEvent(
    request,
    session,
    "checklist_removed",
    auditChecklistRemoved({
      title: loaded.task.title,
      storeName: loaded.store.name,
    }),
  );

  return NextResponse.json({ ok: true });
}
