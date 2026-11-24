import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { auditTemperatureCreated } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import {
  requireRetailOwner,
  temperatureDisabledResponse,
} from "@/lib/temperature-access";
import {
  isValidTemperatureYmd,
  normalizeTemperatureRange,
  purgeTemperatureRetention,
  temperatureCalendarYmd,
  toTemperaturePointDto,
} from "@/lib/temperature";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { isLocalUploadPath } from "@/lib/upload";
import { apiT } from "@/i18n";

const createSchema = z.object({
  storeId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional().nullable(),
  minCelsius: z.number().finite().optional().nullable(),
  maxCelsius: z.number().finite().optional().nullable(),
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

export async function GET(request: Request) {
  const disabled = temperatureDisabledResponse(request);
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

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId")?.trim();
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

  await purgeTemperatureRetention(db).catch(() => undefined);

  const todayYmd = temperatureCalendarYmd();
  const dateParam = url.searchParams.get("date")?.trim();
  const logDate =
    dateParam && isValidTemperatureYmd(dateParam) ? dateParam : todayYmd;

  const isOwner = Boolean(await requireRetailOwner(session.userId));
  const rows = await db.temperaturePoint.findMany({
    where: { storeId, active: true },
    orderBy: { createdAt: "desc" },
    include: {
      readings: {
        where: { logDate },
        include: {
          completedByUser: {
            select: { id: true, username: true, displayName: true },
          },
        },
        take: 1,
      },
    },
  });

  const points = rows.map((row) =>
    toTemperaturePointDto({
      ...row,
      dayReading: row.readings[0]
        ? {
            celsius: row.readings[0].celsius,
            completedAt: row.readings[0].completedAt,
            completedByUser: row.readings[0].completedByUser,
          }
        : null,
    }),
  );

  return NextResponse.json({
    todayYmd,
    logDate,
    isOwner,
    dueIncomplete: points.filter((p) => !p.completed).length,
    points,
  });
}

export async function POST(request: Request) {
  const disabled = temperatureDisabledResponse(request);
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

  const range = normalizeTemperatureRange(parsed.data);
  if ("error" in range) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const title = parsed.data.title.trim();
  const note = parsed.data.note?.trim() || null;
  const comment = parsed.data.comment?.trim() || null;
  const commentImagePath = parsed.data.commentImagePath?.trim() || null;

  const row = await db.temperaturePoint.create({
    data: {
      storeId: parsed.data.storeId,
      title,
      note,
      minCelsius: range.minCelsius,
      maxCelsius: range.maxCelsius,
      comment,
      commentImagePath,
      createdByUserId: session.userId,
    },
  });

  await logAuditEvent(
    request,
    session,
    "temperature_created",
    auditTemperatureCreated({
      title,
      storeName: store.name,
    }),
  );

  return NextResponse.json(
    {
      point: toTemperaturePointDto({
        ...row,
        dayReading: null,
      }),
    },
    { status: 201 },
  );
}
