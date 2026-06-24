import { NextResponse } from "next/server";
import { purgeExpiredInventory } from "@/lib/inventory-purge";
import { apiT } from "@/i18n";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const purged = await purgeExpiredInventory();
  return NextResponse.json({ purged });
}

export async function GET(request: Request) {
  return POST(request);
}
