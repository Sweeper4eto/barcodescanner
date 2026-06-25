import { NextResponse } from "next/server";
import { purgeExpiredInventory } from "@/lib/inventory-purge";
import { sendExpiryDigests } from "@/lib/push-expiry";
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
  const push = await sendExpiryDigests();
  return NextResponse.json({ purged, push });
}

export async function GET(request: Request) {
  return POST(request);
}
