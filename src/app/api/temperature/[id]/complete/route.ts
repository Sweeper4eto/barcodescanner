import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  auditTemperatureCompleted,
  auditTemperatureUncompleted,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { temperatureDisabledResponse } from "@/lib/temperature-access";
import {
  isValidTemperatureYmd,
  normalizeReadingCelsius,
  temperatureCalendarYmd,
  toTemperaturePointDto,
} from "@/lib/temperature";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { isLocalUploadPath } from "@/lib/upload";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  completed: z.boolean(),
  /** Defaults to today (Sofia). May be today or a past day; not future. */
  logDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  celsius: z.number().finite().optional().nullable(),
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

  const { id } = await context.params;
  const point = await db.temperaturePoint.findUnique({ where: { id } });
  if (!point || !point.active) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, point.storeId);
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

  const todayYmd = temperatureCalendarYmd();
  const logDate = parsed.data.logDate ?? todayYmd;
  if (!isValidTemperatureYmd(logDate) || logDate > todayYmd) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  if (
    parsed.data.comment !== undefined ||
    parsed.data.commentImagePath !== undefined
  ) {
    await db.temperaturePoint.update({
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
    const celsius = normalizeReadingCelsius(parsed.data.celsius);
    if (typeof celsius === "object" && celsius !== null && "error" in celsius) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    await db.temperatureReading.upsert({
      where: { pointId_logDate: { pointId: id, logDate } },
      create: {
        pointId: id,
        logDate,
        celsius,
        completedByUserId: session.userId,
      },
      update: {
        celsius,
        completedAt: new Date(),
        completedByUserId: session.userId,
      },
    });

    await logAuditEvent(
      request,
      session,
      "temperature_completed",
      auditTemperatureCompleted({
        title: point.title,
        storeName: store.name,
        logDate,
        celsius,
      }),
    );
  } else {
    await db.temperatureReading.deleteMany({
      where: { pointId: id, logDate },
    });
    await logAuditEvent(
      request,
      session,
      "temperature_uncompleted",
      auditTemperatureUncompleted({
        title: point.title,
        storeName: store.name,
        logDate,
      }),
    );
  }

  const row = await db.temperaturePoint.findUniqueOrThrow({
    where: { id },
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

  return NextResponse.json({
    point: toTemperaturePointDto({
      ...row,
      dayReading: row.readings[0]
        ? {
            celsius: row.readings[0].celsius,
            completedAt: row.readings[0].completedAt,
            completedByUser: row.readings[0].completedByUser,
          }
        : null,
    }),
  });
}
