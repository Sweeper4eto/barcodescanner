import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { temperatureDisabledResponse } from "@/lib/temperature-access";
import {
  purgeTemperatureRetention,
  temperatureCalendarYmd,
} from "@/lib/temperature";
import { db } from "@/lib/db";
import { userCanAccessRetailStore } from "@/lib/store-access";
import { apiT } from "@/i18n";

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

  const storeId = new URL(request.url).searchParams.get("storeId")?.trim();
  if (!storeId) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingStoreId") },
      { status: 400 },
    );
  }

  const store = await userCanAccessRetailStore(session.userId, storeId);
  if (!store) {
    return NextResponse.json({ dueIncomplete: 0, todayYmd: null });
  }

  await purgeTemperatureRetention(db).catch(() => undefined);

  const todayYmd = temperatureCalendarYmd();
  const points = await db.temperaturePoint.findMany({
    where: { storeId, active: true },
    select: {
      id: true,
      readings: {
        where: { logDate: todayYmd },
        select: { id: true },
        take: 1,
      },
    },
  });

  const dueIncomplete = points.filter((p) => p.readings.length === 0).length;

  return NextResponse.json({ dueIncomplete, todayYmd });
}
