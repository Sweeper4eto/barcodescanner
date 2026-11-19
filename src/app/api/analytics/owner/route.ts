import { NextResponse } from "next/server";
import {
  listManagedStoreIds,
  requireStoreManagerOrOwner,
} from "@/lib/client-owner";
import { isAccountOwner } from "@/lib/client-roles";
import { buildOwnerAnalyticsReport } from "@/lib/owner-analytics-query";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
  let session;
  try {
    session = await requireStoreManagerOrOwner();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  let storeId = url.searchParams.get("storeId")?.trim() || undefined;
  const managedStoreIds = await listManagedStoreIds(
    session.userId,
    session.clientId,
    session.clientRole,
  );

  if (storeId) {
    if (!managedStoreIds.includes(storeId)) {
      return NextResponse.json(
        { error: apiT(request, "errors.noStoreAccess") },
        { status: 403 },
      );
    }
  } else if (!isAccountOwner(session.clientRole)) {
    if (managedStoreIds.length === 0) {
      return NextResponse.json(
        { error: apiT(request, "errors.noStoreAccess") },
        { status: 403 },
      );
    }
    // Default to first managed store when no filter is provided.
    storeId = managedStoreIds[0];
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
