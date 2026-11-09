import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  checklistCalendarYmd,
  isChecklistTaskDueOn,
  purgeChecklistRetention,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

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
    return NextResponse.json({ dueTodayIncomplete: 0, todayYmd: null });
  }

  await purgeChecklistRetention(db).catch(() => undefined);

  const todayYmd = checklistCalendarYmd();
  const tasks = await db.checklistTask.findMany({
    where: { storeId, active: true },
    select: {
      recurrence: true,
      dueDate: true,
      weekday: true,
      monthDay: true,
      active: true,
      completions: {
        where: { dueDate: todayYmd },
        select: { id: true },
        take: 1,
      },
    },
  });

  let dueTodayIncomplete = 0;
  for (const task of tasks) {
    if (!isChecklistTaskDueOn(task, todayYmd)) continue;
    if (task.completions.length === 0) dueTodayIncomplete += 1;
  }

  return NextResponse.json({ dueTodayIncomplete, todayYmd });
}
