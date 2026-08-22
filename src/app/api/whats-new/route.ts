import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT, getLocaleFromRequest } from "@/i18n";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const locale = getLocaleFromRequest(request);
  const rows = await db.whatsNewItem.findMany({
    where: { active: true, suppressed: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const items = rows.map((row) => ({
    id: row.id,
    title: locale === "bg" ? row.titleBg : row.titleEn,
    href: row.href,
  }));

  return NextResponse.json({ items });
}