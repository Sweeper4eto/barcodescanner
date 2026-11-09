import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { checklistsDisabledResponse } from "@/lib/checklist-access";
import {
  checklistCalendarYmd,
  checklistCompletionWindowStartYmd,
  isChecklistTaskDueOn,
  pickChecklistPeriodCompletion,
  purgeChecklistRetention,
} from "@/lib/checklist";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
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
  const windowStart = checklistCompletionWindowStartYmd(todayYmd);
  const tasks = await db.checklistTask.findMany({
    where: { storeId, active: true },
    select: {
      recurrence: true,
      dueDate: true,
      weekday: true,
      monthDay: true,
      active: true,
      completions: {
        where: { dueDate: { gte: windowStart, lte: todayYmd } },
        select: { id: true, dueDate: true, completedAt: true },
      },
    },
  });

  let dueTodayIncomplete = 0;
  for (const task of tasks) {
    if (!isChecklistTaskDueOn(task, todayYmd)) continue;
    const done = pickChecklistPeriodCompletion(
      task.completions,
      task.recurrence,
      todayYmd,
    );
    if (!done) dueTodayIncomplete += 1;
  }

  return NextResponse.json({ dueTodayIncomplete, todayYmd });
}
