import { NextResponse } from "next/server";
import { apiT } from "@/i18n";
import { requireAdmin } from "@/lib/auth";

/** Admin session, or a 403 response. One place for every `/api/admin` route. */
export async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MUST_CHANGE_PASSWORD") {
      return NextResponse.json(
        {
          error: apiT(request, "auth.mustChangePassword"),
          code: "MUST_CHANGE_PASSWORD",
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}
