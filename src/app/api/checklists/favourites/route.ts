import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  checklistsDisabledResponse,
  requireRetailOwner,
} from "@/lib/checklist-access";
import {
  checklistCalendarYmd,
  checklistCompletionWindowStartYmd,
  normalizeChecklistFields,
  pickChecklistPeriodCompletion,
  toChecklistFavouriteDto,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

const createFavouriteSchema = z.object({
  storeId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional().nullable(),
  recurrence: z.enum(["daily", "weekly", "monthly", "once"]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  weekday: z.number().int().min(0).max(6).optional().nullable(),
  monthDay: z.number().int().min(1).max(31).optional().nullable(),
});

const addFromFavouriteSchema = z.object({
  storeId: z.string().min(1),
  favouriteId: z.string().min(1),
});

/** Owner: save a template into the favourites catalog. */
export async function POST(request: Request) {
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

  const json = await request.json().catch(() => null);
  const parsed = createFavouriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(
    session.userId,
    parsed.data.storeId,
  );
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const fields = normalizeChecklistFields(parsed.data);
  if ("error" in fields) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const title = parsed.data.title.trim();
  const favourite = await db.checklistFavourite.upsert({
    where: {
      storeId_title: { storeId: parsed.data.storeId, title },
    },
    create: {
      storeId: parsed.data.storeId,
      title,
      note: parsed.data.note?.trim() || null,
      recurrence: fields.recurrence,
      dueDate: fields.dueDate,
      weekday: fields.weekday,
      monthDay: fields.monthDay,
    },
    update: {
      note: parsed.data.note?.trim() || null,
      recurrence: fields.recurrence,
      dueDate: fields.dueDate,
      weekday: fields.weekday,
      monthDay: fields.monthDay,
    },
  });

  return NextResponse.json(
    { favourite: toChecklistFavouriteDto(favourite) },
    { status: 201 },
  );
}

/**
 * Any store member: pull a favourite into the working checklist list.
 * If an active task with the same title already exists, return it.
 */
export async function PUT(request: Request) {
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

  const json = await request.json().catch(() => null);
  const parsed = addFromFavouriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(
    session.userId,
    parsed.data.storeId,
  );
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  const favourite = await db.checklistFavourite.findFirst({
    where: { id: parsed.data.favouriteId, storeId: parsed.data.storeId },
  });
  if (!favourite) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  const todayYmd = checklistCalendarYmd();
  const windowStart = checklistCompletionWindowStartYmd(todayYmd);
  const existing = await db.checklistTask.findFirst({
    where: {
      storeId: parsed.data.storeId,
      active: true,
      title: favourite.title,
    },
    include: {
      completions: {
        where: { dueDate: { gte: windowStart, lte: todayYmd } },
        include: {
          completedByUser: {
            select: { id: true, username: true, displayName: true },
          },
        },
      },
    },
  });

  if (existing) {
    const periodCompletion = pickChecklistPeriodCompletion(
      existing.completions,
      existing.recurrence,
      todayYmd,
    );
    return NextResponse.json({
      task: toChecklistTaskDto({
        ...existing,
        inFavourites: true,
        todayYmd,
        todayCompletion: periodCompletion
          ? {
              completedAt: periodCompletion.completedAt,
              completedByUser: periodCompletion.completedByUser,
            }
          : null,
      }),
      created: false,
    });
  }

  const row = await db.checklistTask.create({
    data: {
      storeId: favourite.storeId,
      title: favourite.title,
      note: favourite.note,
      recurrence: favourite.recurrence,
      dueDate: favourite.dueDate,
      weekday: favourite.weekday,
      monthDay: favourite.monthDay,
      createdByUserId: session.userId,
    },
  });

  return NextResponse.json(
    {
      task: toChecklistTaskDto({
        ...row,
        inFavourites: true,
        todayYmd,
        todayCompletion: null,
      }),
      created: true,
    },
    { status: 201 },
  );
}
