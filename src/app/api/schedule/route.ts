import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { requireClientOwner } from "@/lib/client-owner";
import { db } from "@/lib/db";
import { userCanAccessStore } from "@/lib/store-access";
import { apiT } from "@/i18n";
import {
  autoFillWeek,
  clampScheduleMinutes,
  isValidWeekStart,
  mondayOfWeek,
  validateDayShifts,
  validateWindow,
  type PreferenceInput,
  type ScheduleMode,
  type ShiftDraft,
} from "@/lib/schedule";

const preferenceBody = z.object({
  storeId: z.string().min(1),
  weekStart: z.string().min(1),
  dayIndex: z.number().int().min(0).max(6),
  startMin: z.number().int(),
  endMin: z.number().int(),
});

const ownerBody = z.object({
  storeId: z.string().min(1),
  weekStart: z.string().min(1),
  action: z.enum([
    "setMode",
    "runAuto",
    "setShifts",
    "finalize",
    "reopen",
  ]),
  mode: z.enum(["auto", "manual"]).optional(),
  shifts: z
    .array(
      z.object({
        userId: z.string().min(1),
        dayIndex: z.number().int().min(0).max(6),
        startMin: z.number().int(),
        endMin: z.number().int(),
      }),
    )
    .optional(),
});

async function ensureWeek(storeId: string, weekStart: string) {
  return db.storeScheduleWeek.upsert({
    where: { storeId_weekStart: { storeId, weekStart } },
    create: { storeId, weekStart, mode: "auto", status: "DRAFT" },
    update: {},
  });
}

async function loadStaff(storeId: string) {
  const links = await db.userStore.findMany({
    where: {
      storeId,
      user: { active: true, role: "USER" },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          clientRole: true,
        },
      },
    },
    orderBy: { user: { username: "asc" } },
  });
  return links.map((link) => link.user);
}

function serializeWeek(
  week: {
    id: string;
    storeId: string;
    weekStart: string;
    mode: string;
    status: string;
    finalizedAt: Date | null;
    preferences: {
      id: string;
      userId: string;
      dayIndex: number;
      startMin: number;
      endMin: number;
    }[];
    shifts: {
      id: string;
      userId: string;
      dayIndex: number;
      startMin: number;
      endMin: number;
    }[];
  },
  staff: { id: string; username: string; clientRole: string | null }[],
  isOwner: boolean,
  meId: string,
) {
  return {
    week: {
      id: week.id,
      storeId: week.storeId,
      weekStart: week.weekStart,
      mode: week.mode as ScheduleMode,
      status: week.status,
      finalizedAt: week.finalizedAt?.toISOString() ?? null,
    },
    staff,
    preferences: week.preferences,
    shifts: week.shifts,
    me: { userId: meId, isOwner },
  };
}

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

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId")?.trim() ?? "";
  const weekStartRaw = url.searchParams.get("weekStart")?.trim() ?? "";
  const weekStart = weekStartRaw || mondayOfWeek();

  if (!storeId || !isValidWeekStart(weekStart)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const me = await db.user.findUnique({
    where: { id: session.userId },
    select: { clientRole: true },
  });
  const isOwner = me?.clientRole === "OWNER";

  const week = await ensureWeek(storeId, weekStart);
  const full = await db.storeScheduleWeek.findUniqueOrThrow({
    where: { id: week.id },
    include: { preferences: true, shifts: true },
  });
  const staff = await loadStaff(storeId);

  return NextResponse.json(serializeWeek(full, staff, isOwner, session.userId));
}

/** Employee (or owner) saves desired hours for one day. */
export async function PUT(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const parsed = preferenceBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { storeId, weekStart, dayIndex } = parsed.data;
  const startMin = clampScheduleMinutes(parsed.data.startMin);
  const endMin = clampScheduleMinutes(parsed.data.endMin);

  if (!isValidWeekStart(weekStart) || !validateWindow(startMin, endMin)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await userCanAccessStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const week = await ensureWeek(storeId, weekStart);
  if (week.status === "FINALIZED") {
    return NextResponse.json(
      { error: apiT(request, "schedule.locked") },
      { status: 409 },
    );
  }

  await db.schedulePreference.upsert({
    where: {
      weekId_userId_dayIndex: {
        weekId: week.id,
        userId: session.userId,
        dayIndex,
      },
    },
    create: {
      weekId: week.id,
      userId: session.userId,
      dayIndex,
      startMin,
      endMin,
    },
    update: { startMin, endMin },
  });

  // When auto mode, refresh generated shifts from all preferences.
  if (week.mode === "auto") {
    const staff = await loadStaff(storeId);
    const preferences = await db.schedulePreference.findMany({
      where: { weekId: week.id },
    });
    const drafts = autoFillWeek({
      staffUserIds: staff.map((s) => s.id),
      preferences: preferences as PreferenceInput[],
    });
    await replaceShifts(week.id, drafts);
  }

  const full = await db.storeScheduleWeek.findUniqueOrThrow({
    where: { id: week.id },
    include: { preferences: true, shifts: true },
  });
  const staff = await loadStaff(storeId);
  const me = await db.user.findUnique({
    where: { id: session.userId },
    select: { clientRole: true },
  });

  return NextResponse.json(
    serializeWeek(full, staff, me?.clientRole === "OWNER", session.userId),
  );
}

/** Owner: mode, auto-run, manual shifts, finalize / reopen. */
export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const parsed = ownerBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { storeId, weekStart, action } = parsed.data;
  if (!isValidWeekStart(weekStart)) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const store = await db.store.findFirst({
    where: { id: storeId, clientId: session.clientId, active: true },
  });
  if (!store) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const week = await ensureWeek(storeId, weekStart);

  if (action === "reopen") {
    await db.storeScheduleWeek.update({
      where: { id: week.id },
      data: {
        status: "DRAFT",
        finalizedAt: null,
        finalizedByUserId: null,
      },
    });
  } else if (week.status === "FINALIZED" && action !== "finalize") {
    return NextResponse.json(
      { error: apiT(request, "schedule.locked") },
      { status: 409 },
    );
  } else if (action === "setMode") {
    const mode = parsed.data.mode ?? "auto";
    await db.storeScheduleWeek.update({
      where: { id: week.id },
      data: { mode },
    });
    if (mode === "auto") {
      const staff = await loadStaff(storeId);
      const preferences = await db.schedulePreference.findMany({
        where: { weekId: week.id },
      });
      await replaceShifts(
        week.id,
        autoFillWeek({
          staffUserIds: staff.map((s) => s.id),
          preferences: preferences as PreferenceInput[],
        }),
      );
    }
  } else if (action === "runAuto") {
    await db.storeScheduleWeek.update({
      where: { id: week.id },
      data: { mode: "auto" },
    });
    const staff = await loadStaff(storeId);
    const preferences = await db.schedulePreference.findMany({
      where: { weekId: week.id },
    });
    await replaceShifts(
      week.id,
      autoFillWeek({
        staffUserIds: staff.map((s) => s.id),
        preferences: preferences as PreferenceInput[],
      }),
    );
  } else if (action === "setShifts") {
    const shifts = (parsed.data.shifts ?? []).map((s) => ({
      ...s,
      startMin: clampScheduleMinutes(s.startMin),
      endMin: clampScheduleMinutes(s.endMin),
    }));
    for (let day = 0; day < 7; day++) {
      const dayShifts = shifts.filter((s) => s.dayIndex === day);
      const check = validateDayShifts(dayShifts);
      if (!check.ok) {
        return NextResponse.json(
          { error: apiT(request, "schedule.overlapOrBounds") },
          { status: 400 },
        );
      }
    }
    await db.storeScheduleWeek.update({
      where: { id: week.id },
      data: { mode: "manual" },
    });
    await replaceShifts(week.id, shifts);
  } else if (action === "finalize") {
    await db.storeScheduleWeek.update({
      where: { id: week.id },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedByUserId: session.userId,
      },
    });
  }

  const full = await db.storeScheduleWeek.findUniqueOrThrow({
    where: { id: week.id },
    include: { preferences: true, shifts: true },
  });
  const staff = await loadStaff(storeId);

  return NextResponse.json(
    serializeWeek(full, staff, true, session.userId),
  );
}

async function replaceShifts(weekId: string, drafts: ShiftDraft[]) {
  await db.$transaction(async (tx) => {
    await tx.scheduleShift.deleteMany({ where: { weekId } });
    if (drafts.length === 0) return;
    await tx.scheduleShift.createMany({
      data: drafts.map((d) => ({
        weekId,
        userId: d.userId,
        dayIndex: d.dayIndex,
        startMin: d.startMin,
        endMin: d.endMin,
      })),
    });
  });
}
