import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";

export async function GET(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode")?.trim();
  if (!barcode) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingBarcode") },
      { status: 400 },
    );
  }

  const product = await db.product.findUnique({ where: { barcode } });
  return NextResponse.json({ product });
}

const createSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  imagePath: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.unauthorized") },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const existing = await db.product.findUnique({
    where: { barcode: parsed.data.barcode },
  });
  if (existing) {
    return NextResponse.json(
      { error: apiT(request, "errors.productExists"), product: existing },
      { status: 409 },
    );
  }

  const product = await db.product.create({ data: parsed.data });
  return NextResponse.json({ product }, { status: 201 });
}
