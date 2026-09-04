import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  type AuditFilter,
  getAuditFilterOptions,
  queryAuditLog,
  serializeAuditEntries,
} from "@/lib/audit-log";
import { apiT } from "@/i18n";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

const FILTERS: AuditFilter[] = ["all", "auth", "inventory", "products", "admin"];

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  try {
    const { searchParams } = new URL(request.url);
    const filterRaw = searchParams.get("filter") ?? "all";
    const filter: AuditFilter = FILTERS.includes(filterRaw as AuditFilter)
      ? (filterRaw as AuditFilter)
      : "all";

    const includeOptions = searchParams.get("options") === "1";
    const [result, options] = await Promise.all([
      queryAuditLog({
        filter,
        q: searchParams.get("q") ?? undefined,
        username: searchParams.get("username") ?? undefined,
        store: searchParams.get("store") ?? undefined,
        ip: searchParams.get("ip") ?? undefined,
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
        timeFrom: searchParams.get("timeFrom") ?? undefined,
        timeTo: searchParams.get("timeTo") ?? undefined,
        page: Number(searchParams.get("page") ?? "1"),
        pageSize: Number(searchParams.get("pageSize") ?? "20"),
      }),
      includeOptions ? getAuditFilterOptions() : Promise.resolve(null),
    ]);

    return NextResponse.json({
      ...result,
      entries: serializeAuditEntries(result.entries),
      ...(options ? { options } : {}),
    });
  } catch (error) {
    console.error("audit-log GET failed:", error);
    return NextResponse.json(
      { error: apiT(request, "errors.auditLogFailed") },
      { status: 500 },
    );
  }
}
