import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireRetailOwner } from "@/lib/checklist-access";
import {
  checklistCalendarYmd,
  normalizeChecklistFields,
  purgeChecklistRetention,
  toChecklistFavouriteDto,
  toChecklistTaskDto,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

const createSchema = z.object({
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
  /** Also save this definition into the favourites catalog. */
  saveAsFavourite: z.boolean().optional(),
});

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const storeId = new URL(request.url).searchParams.get("storeId")?.trim();
  if (!storeId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.noStoreAccess") },
      { status: 403 },
    );
  }

  await purgeChecklistRetention(db).catch(() => undefined);

  const todayYmd = checklistCalendarYmd();
  const [rows, favouriteRows, user] = await Promise.all([
    db.checklistTask.findMany({
      where: { storeId, active: true },
      orderBy: { createdAt: "desc" },
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
    }),
    db.checklistFavourite.findMany({
      where: { storeId },
      orderBy: { updatedAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: session.userId },
      select: { clientRole: true },
    }),
  ]);

  const favouriteTitles = new Set(
    favouriteRows.map((row) => row.title.trim().toLowerCase()),
  );

  const tasks = rows.map((row) =>
    toChecklistTaskDto({
      ...row,
      inFavourites: favouriteTitles.has(row.title.trim().toLowerCase()),
      todayYmd,
      todayCompletion: row.completions[0]
        ? {
            completedAt: row.completions[0].completedAt,
            completedByUser: row.completions[0].completedByUser,
          }
        : null,
    }),
  );

  return NextResponse.json({
    todayYmd,
    isOwner: user?.clientRole === "OWNER",
    dueTodayIncomplete: tasks.filter((t) => t.dueToday && !t.completedToday)
      .length,
    favourites: favouriteRows.map(toChecklistFavouriteDto),
    tasks,
  });
}

export async function POST(request: Request) {
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
  const parsed = createSchema.safeParse(json);
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
  const note = parsed.data.note?.trim() || null;

  const row = await db.checklistTask.create({
    data: {
      storeId: parsed.data.storeId,
      title,
      note,
      recurrence: fields.recurrence,
      dueDate: fields.dueDate,
      weekday: fields.weekday,
      monthDay: fields.monthDay,
      createdByUserId: session.userId,
    },
  });

  let favourite = null;
  if (parsed.data.saveAsFavourite) {
    favourite = await db.checklistFavourite.upsert({
      where: {
        storeId_title: {
          storeId: parsed.data.storeId,
          title,
        },
      },
      create: {
        storeId: parsed.data.storeId,
        title,
        note,
        recurrence: fields.recurrence,
        dueDate: fields.dueDate,
        weekday: fields.weekday,
        monthDay: fields.monthDay,
      },
      update: {
        note,
        recurrence: fields.recurrence,
        dueDate: fields.dueDate,
        weekday: fields.weekday,
        monthDay: fields.monthDay,
      },
    });
  }

  const todayYmd = checklistCalendarYmd();
  return NextResponse.json(
    {
      task: toChecklistTaskDto({
        ...row,
        inFavourites: Boolean(favourite),
        todayYmd,
        todayCompletion: null,
      }),
      favourite: favourite ? toChecklistFavouriteDto(favourite) : null,
    },
    { status: 201 },
  );
}
