import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  auditFieldChange,
  auditTemperatureRemoved,
  auditTemperatureUpdated,
} from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import {
  requireRetailOwner,
  temperatureDisabledResponse,
} from "@/lib/temperature-access";
import {
  isValidTemperatureYmd,
  normalizeTemperatureRange,
  temperatureCalendarYmd,
  toTemperaturePointDto,
} from "@/lib/temperature";
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
  minCelsius: z.number().finite().optional().nullable(),
  maxCelsius: z.number().finite().optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
  commentImagePath: commentImagePathSchema,
  active: z.boolean().optional(),
});

const staffCommentPatchSchema = z.object({
  comment: z.string().trim().max(2000).nullable(),
  commentImagePath: commentImagePathSchema,
});

async function loadPointForAccess(pointId: string, userId: string) {
  const point = await db.temperaturePoint.findUnique({ where: { id: pointId } });
  if (!point || !point.active) return { error: "not_found" as const };
  const store = await userCanAccessRetailStore(userId, point.storeId);
  if (!store) return { error: "forbidden" as const };
  const isOwner = Boolean(await requireRetailOwner(userId));
  return { point, store, isOwner };
}

async function pointResponse(pointId: string, logDate: string) {
  const row = await db.temperaturePoint.findUniqueOrThrow({
    where: { id: pointId },
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
  return {
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
  };
}

export async function PATCH(
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
  const loaded = await loadPointForAccess(id, session.userId);
  if ("error" in loaded) {
    const status = loaded.error === "forbidden" ? 403 : 404;
    return NextResponse.json(
      { error: apiT(request, status === 403 ? "errors.forbidden" : "errors.entryNotFound") },
      { status },
    );
  }

  const json = await request.json().catch(() => null);
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date")?.trim();
  const logDate =
    dateParam && isValidTemperatureYmd(dateParam)
      ? dateParam
      : temperatureCalendarYmd();

  if (loaded.isOwner) {
    const parsed = ownerPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const range =
      parsed.data.minCelsius !== undefined ||
      parsed.data.maxCelsius !== undefined
        ? normalizeTemperatureRange({
            minCelsius:
              parsed.data.minCelsius !== undefined
                ? parsed.data.minCelsius
                : loaded.point.minCelsius,
            maxCelsius:
              parsed.data.maxCelsius !== undefined
                ? parsed.data.maxCelsius
                : loaded.point.maxCelsius,
          })
        : null;
    if (range && "error" in range) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const title = parsed.data.title?.trim();
    const changes = [
      title !== undefined
        ? auditFieldChange("title", loaded.point.title, title)
        : null,
      parsed.data.note !== undefined
        ? auditFieldChange("note", loaded.point.note, parsed.data.note)
        : null,
      range
        ? auditFieldChange(
            "minC",
            loaded.point.minCelsius,
            range.minCelsius,
          )
        : null,
      range
        ? auditFieldChange(
            "maxC",
            loaded.point.maxCelsius,
            range.maxCelsius,
          )
        : null,
    ];

    await db.temperaturePoint.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(parsed.data.note !== undefined
          ? { note: parsed.data.note?.trim() || null }
          : {}),
        ...(range
          ? { minCelsius: range.minCelsius, maxCelsius: range.maxCelsius }
          : {}),
        ...(parsed.data.comment !== undefined
          ? { comment: parsed.data.comment?.trim() || null }
          : {}),
        ...(parsed.data.commentImagePath !== undefined
          ? {
              commentImagePath: parsed.data.commentImagePath?.trim() || null,
            }
          : {}),
        ...(parsed.data.active !== undefined
          ? { active: parsed.data.active }
          : {}),
      },
    });

    await logAuditEvent(
      request,
      session,
      "temperature_updated",
      auditTemperatureUpdated({
        title: title ?? loaded.point.title,
        storeName: loaded.store.name,
        changes,
      }),
    );

    return NextResponse.json(await pointResponse(id, logDate));
  }

  const parsed = staffCommentPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  await db.temperaturePoint.update({
    where: { id },
    data: {
      comment: parsed.data.comment?.trim() || null,
      ...(parsed.data.commentImagePath !== undefined
        ? {
            commentImagePath: parsed.data.commentImagePath?.trim() || null,
          }
        : {}),
    },
  });

  return NextResponse.json(await pointResponse(id, logDate));
}

export async function DELETE(
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

  const owner = await requireRetailOwner(session.userId);
  if (!owner) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const loaded = await loadPointForAccess(id, session.userId);
  if ("error" in loaded) {
    const status = loaded.error === "forbidden" ? 403 : 404;
    return NextResponse.json(
      { error: apiT(request, status === 403 ? "errors.forbidden" : "errors.entryNotFound") },
      { status },
    );
  }

  await db.temperaturePoint.update({
    where: { id },
    data: { active: false },
  });

  await logAuditEvent(
    request,
    session,
    "temperature_removed",
    auditTemperatureRemoved({
      title: loaded.point.title,
      storeName: loaded.store.name,
    }),
  );

  return NextResponse.json({ ok: true });
}
