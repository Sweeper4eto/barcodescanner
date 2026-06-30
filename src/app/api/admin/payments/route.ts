import { NextResponse } from "next/server";
import { z } from "zod";
import { auditPaymentRecorded } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { requireAdmin } from "@/lib/auth";
import { paymentAmount } from "@/lib/expiry";
import { db } from "@/lib/db";
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

const paymentSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const payments = await db.payment.findMany({
    where: {
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
    },
    include: { client: { select: { id: true, name: true, active: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const json = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { stores: { where: { active: true } } },
  });
  if (!client) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  const activeStoreCount = client.stores.length;
  const feePerStore = client.monthlyFeePerStore;
  const amountPaid = paymentAmount(
    activeStoreCount,
    feePerStore,
    parsed.data.discount,
  );

  const payment = await db.payment.upsert({
    where: {
      clientId_year_month: {
        clientId: client.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    create: {
      clientId: client.id,
      year: parsed.data.year,
      month: parsed.data.month,
      activeStoreCount,
      feePerStore,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
    },
    update: {
      activeStoreCount,
      feePerStore,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
      paidAt: new Date(),
    },
  });

  await logAuditEvent(
    request,
    admin,
    "payment_recorded",
    auditPaymentRecorded({
      clientName: client.name,
      year: parsed.data.year,
      month: parsed.data.month,
      activeStoreCount,
      feePerStore,
      discount: parsed.data.discount,
      amountPaid,
      notes: parsed.data.notes,
    }),
  );

  return NextResponse.json({ payment }, { status: 201 });
}
