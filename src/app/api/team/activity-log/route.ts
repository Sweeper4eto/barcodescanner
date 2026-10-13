import { NextResponse } from "next/server";
import { requireClientOwner } from "@/lib/client-owner";
import {
  type OwnerActivityFilter,
  OWNER_ACTIVITY_EVENTS,
  getAuditFilterOptions,
  queryAuditLog,
  serializeAuditEntries,
} from "@/lib/audit-log";
import { apiT } from "@/i18n";

const FILTERS: OwnerActivityFilter[] = ["all", "auth", "inventory", "products"];

async function ownerOrForbidden(request: Request) {
  try {
    return await requireClientOwner();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED" || message === "PAYMENT_REQUIRED") {
      return NextResponse.json(
        { error: apiT(request, "errors.unauthorized") },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

export async function GET(request: Request) {
  const owner = await ownerOrForbidden(request);
  if (owner instanceof NextResponse) return owner;

  try {
    const { searchParams } = new URL(request.url);
    const filterRaw = searchParams.get("filter") ?? "all";
    const filter: OwnerActivityFilter = FILTERS.includes(
      filterRaw as OwnerActivityFilter,
    )
      ? (filterRaw as OwnerActivityFilter)
      : "all";

    // Always scope to this owner's client — never trust a clientId from the query.
    const options = await getAuditFilterOptions({ clientId: owner.clientId });
    const allowedUsernames = new Set(options.usernames);
    const allowedStores = new Set(options.stores.map((store) => store.name));

    const usernameRaw = searchParams.get("username")?.trim() ?? "";
    const username =
      usernameRaw && allowedUsernames.has(usernameRaw) ? usernameRaw : undefined;

    const storeRaw = searchParams.get("store")?.trim() ?? "";
    const store =
      storeRaw && allowedStores.has(storeRaw) ? storeRaw : undefined;

    const result = await queryAuditLog({
      filter,
      clientId: owner.clientId,
      eventsAllowlist: OWNER_ACTIVITY_EVENTS,
      username,
      store,
      q: searchParams.get("q") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      timeFrom: searchParams.get("timeFrom") ?? undefined,
      timeTo: searchParams.get("timeTo") ?? undefined,
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: Number(searchParams.get("pageSize") ?? "20"),
    });

    return NextResponse.json({
      ...result,
      entries: serializeAuditEntries(result.entries),
      options: {
        usernames: options.usernames,
        stores: options.stores.map((storeRow) => ({
          id: storeRow.id,
          name: storeRow.name,
          active: storeRow.active,
        })),
      },
    });
  } catch (error) {
    console.error("team activity-log GET failed:", error);
    return NextResponse.json(
      { error: apiT(request, "errors.auditLogFailed") },
      { status: 500 },
    );
  }
}
