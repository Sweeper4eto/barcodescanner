import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  type AuditFilter,
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

    const result = await queryAuditLog({
      filter,
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
    });
  } catch (error) {
    console.error("audit-log GET failed:", error);
    return NextResponse.json(
      { error: apiT(request, "errors.auditLogFailed") },
      { status: 500 },
    );
  }
}
