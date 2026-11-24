import { NextResponse } from "next/server";
import { TEMPERATURE_FEATURE_ENABLED } from "@/lib/temperature";
import { requireRetailOwner, isRetailOwner } from "@/lib/checklist-access";
import { apiT } from "@/i18n";

/** Returns a 404 response when temperature journals are globally disabled. */
export function temperatureDisabledResponse(request: Request) {
  if (TEMPERATURE_FEATURE_ENABLED) return null;
  return NextResponse.json(
    { error: apiT(request, "errors.entryNotFound") },
    { status: 404 },
  );
}

export { requireRetailOwner, isRetailOwner };
