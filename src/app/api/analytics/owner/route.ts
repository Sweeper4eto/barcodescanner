import { NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/client-owner";
import { buildOwnerAnalyticsReport } from "@/lib/owner-analytics-query";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireClientOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId")?.trim() || undefined;

  if (storeId) {
    const store = await db.store.findFirst({
      where: { id: storeId, clientId: session.clientId },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json(
        { error: apiT(request, "errors.noStoreAccess") },
        { status: 403 },
      );
    }
  }

  try {
    const report = await buildOwnerAnalyticsReport(session.clientId, {
      storeId,
    });
    return NextResponse.json({ report });
  } catch (error) {
    console.error("owner analytics failed:", error);
    return NextResponse.json(
      { error: apiT(request, "errors.networkError") },
      { status: 500 },
    );
  }
}
