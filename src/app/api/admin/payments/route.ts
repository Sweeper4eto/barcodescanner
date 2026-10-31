import { requireAdminResponse } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditPaymentRecorded } from "@/lib/audit-details";
import { logAuditEvent } from "@/lib/audit-log";
import { paymentAmount } from "@/lib/expiry";
import { db } from "@/lib/db";
import {
  expectedPaymentAmount,
  qualifyingReferralInclude,
  qualifyingReferralWhere,
  suggestedReferralDiscount,
  sumLocationFees,
} from "@/lib/location-fees";
import { apiT } from "@/i18n";
import {
  parsePaymentReference,
  paymentReferenceFor,
  resolvePaymentReference,
} from "@/lib/payment-reference";
import {
  addMonths,
  billingStartPeriod,
  comparePeriods,
  countStandingUnpaidMonths,
  monthsInclusive,
  needsPaymentsRequiredSinceRepair,
  paymentStandingFromUnpaid,
  periodFromDate,
  periodKey,
  startOfBillingMonth,
  standingSortRank,
} from "@/lib/payment-status";

const paymentSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  /** Omit to apply the qualifying referral discount automatically. */
  discount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const clientId = (searchParams.get("clientId") ?? "").trim();
  const statusList = searchParams.get("status") === "1";
  const referenceQuery = (searchParams.get("reference") ?? "").trim();

  if (referenceQuery) {
    if (!parsePaymentReference(referenceQuery)) {
      return NextResponse.json(
        { error: apiT(request, "admin.paymentReferenceInvalid") },
        { status: 400 },
      );
    }
    const clients = await db.client.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        homeUser: true,
      },
      orderBy: { name: "asc" },
    });
    const hit = resolvePaymentReference(
      referenceQuery,
      clients.map((c) => c.id),
    );
    if (!hit) {
      return NextResponse.json(
        { error: apiT(request, "admin.paymentReferenceNotFound") },
        { status: 404 },
      );
    }
    const client = clients.find((c) => c.id === hit.clientId)!;
    const payment = await db.payment.findUnique({
      where: {
        clientId_year_month: {
          clientId: hit.clientId,
          year: hit.year,
          month: hit.month,
        },
      },
      select: {
        id: true,
        amountPaid: true,
        discount: true,
        notes: true,
        paidAt: true,
      },
    });
    return NextResponse.json({
      client,
      year: hit.year,
      month: hit.month,
      paymentReference: paymentReferenceFor(
        hit.clientId,
        hit.year,
        hit.month,
      ),
      paid: Boolean(payment),
      payment,
    });
  }

  if (statusList) {
    const now = new Date();
    const through = periodFromDate(now);
    const clients = await db.client.findMany({
      include: {
        stores: { select: { id: true, active: true, monthlyFee: true } },
        payments: { select: { year: true, month: true } },
        referrals: qualifyingReferralInclude,
      },
      orderBy: { name: "asc" },
    });

    const sinceRepairs: Array<{ id: string; paymentsRequiredSince: Date }> =
      [];
    for (const client of clients) {
      if (
        needsPaymentsRequiredSinceRepair({
          paymentsRequired: client.paymentsRequired,
          paymentsRequiredSince: client.paymentsRequiredSince,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
          now,
        })
      ) {
        const repaired = startOfBillingMonth(now);
        sinceRepairs.push({ id: client.id, paymentsRequiredSince: repaired });
        client.paymentsRequiredSince = repaired;
      }
    }
    if (sinceRepairs.length > 0) {
      await Promise.all(
        sinceRepairs.map((row) =>
          db.client.update({
            where: { id: row.id },
            data: { paymentsRequiredSince: row.paymentsRequiredSince },
          }),
        ),
      );
    }

    const rows = clients.map((client) => {
      const activeStores = client.stores.filter((s) => s.active);
      const activeStoreCount = activeStores.length;
      const locationsFeeTotal = sumLocationFees(activeStores);
      const referralCount = client.referrals.length;
      const expectedAmount = expectedPaymentAmount(
        locationsFeeTotal,
        referralCount,
      );
      const paidKeys = new Set(
        client.payments.map((p) => periodKey(p.year, p.month)),
      );
      const tracksPayments =
        !client.homeUser &&
        client.paymentsRequired &&
        expectedAmount > 0;
      const start = billingStartPeriod({
        paymentsRequired: client.paymentsRequired,
        paymentsRequiredSince: client.paymentsRequiredSince,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        now,
      });
      const unpaidMonths =
        tracksPayments && start
          ? countStandingUnpaidMonths({
              billingStart: start,
              current: through,
              paidKeys,
            })
          : 0;
      const currentMonthPaid =
        !tracksPayments ||
        paidKeys.has(periodKey(through.year, through.month));
      const standing = paymentStandingFromUnpaid(unpaidMonths, {
        homeUser: client.homeUser,
        paymentsRequired: client.paymentsRequired,
        expectedAmount,
        currentMonthPaid,
      });
      return {
        client: {
          id: client.id,
          name: client.name,
          active: client.active,
          homeUser: client.homeUser,
          paymentsRequired: client.paymentsRequired,
          locationsFeeTotal,
          referralCount,
          createdAt: client.createdAt.toISOString(),
        },
        activeStoreCount,
        storeCount: client.stores.length,
        expectedAmount,
        referralCount,
        referralDiscount: suggestedReferralDiscount(referralCount),
        unpaidMonths,
        standing,
      };
    });

    rows.sort((a, b) => {
      const rank = standingSortRank(a.standing) - standingSortRank(b.standing);
      if (rank !== 0) return rank;
      return a.client.name.localeCompare(b.client.name);
    });

    return NextResponse.json({ through, rows });
  }

  if (clientId) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      include: {
        stores: { orderBy: { name: "asc" } },
        referredBy: { select: { id: true, name: true, active: true } },
        referrals: {
          where: qualifyingReferralWhere,
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!client) {
      return NextResponse.json(
        { error: apiT(request, "errors.clientNotFound") },
        { status: 404 },
      );
    }

    const allPayments = await db.payment.findMany({
      where: { clientId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const paidKeys = new Set(
      allPayments.map((p) => periodKey(p.year, p.month)),
    );
    const now = new Date();
    const through = periodFromDate(now);
    const activeStores = client.stores.filter((s) => s.active);
    const activeStoreCount = activeStores.length;
    const locationsFeeTotal = sumLocationFees(activeStores);
    const referralCount = client.referrals.length;
    const referralDiscount = suggestedReferralDiscount(referralCount);
    const expectedAmount = expectedPaymentAmount(
      locationsFeeTotal,
      referralCount,
    );
    const tracksPayments =
      !client.homeUser &&
      client.paymentsRequired &&
      expectedAmount > 0;
    let paymentsRequiredSince = client.paymentsRequiredSince;
    if (
      needsPaymentsRequiredSinceRepair({
        paymentsRequired: client.paymentsRequired,
        paymentsRequiredSince: client.paymentsRequiredSince,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        now,
      })
    ) {
      paymentsRequiredSince = startOfBillingMonth(now);
      await db.client.update({
        where: { id: client.id },
        data: { paymentsRequiredSince },
      });
    }
    const start = billingStartPeriod({
      paymentsRequired: client.paymentsRequired,
      paymentsRequiredSince,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      now,
    });
    const unpaidMonths =
      tracksPayments && start
        ? countStandingUnpaidMonths({
            billingStart: start,
            current: through,
            paidKeys,
          })
        : 0;
    const currentMonthPaid =
      !tracksPayments ||
      paidKeys.has(periodKey(through.year, through.month));
    const standing = paymentStandingFromUnpaid(unpaidMonths, {
      homeUser: client.homeUser,
      paymentsRequired: client.paymentsRequired,
      expectedAmount,
      currentMonthPaid,
    });

    const historyEnd = addMonths(through, 3);
    const historyStart =
      start ??
      periodFromDate(client.createdAt);
    // Include any recorded payments before billing start (legacy / manual).
    let refStart = historyStart;
    for (const payment of allPayments) {
      const period = { year: payment.year, month: payment.month };
      if (comparePeriods(period, refStart) < 0) refStart = period;
    }
    const paymentReferences: Record<string, string> = {};
    for (const period of monthsInclusive(refStart, historyEnd)) {
      paymentReferences[periodKey(period.year, period.month)] =
        paymentReferenceFor(client.id, period.year, period.month);
    }

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        active: client.active,
        homeUser: client.homeUser,
        paymentsRequired: client.paymentsRequired,
        referredByClientId: client.referredByClientId,
        locationsFeeTotal,
        createdAt: client.createdAt.toISOString(),
      },
      referredBy: client.referredBy,
      referrals: client.referrals,
      stores: client.stores.map((store) => ({
        id: store.id,
        name: store.name,
        active: store.active,
        monthlyFee: store.monthlyFee,
      })),
      activeStoreCount,
      locationsFeeTotal,
      expectedAmount,
      referralCount,
      referralDiscount,
      unpaidMonths,
      standing,
      billingStart: start,
      historyStart: refStart,
      historyEnd,
      paymentReferences,
      payments: allPayments,
    });
  }

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
    include: {
      stores: { where: { active: true } },
      referrals: qualifyingReferralInclude,
    },
  });
  if (!client) {
    return NextResponse.json(
      { error: apiT(request, "errors.clientNotFound") },
      { status: 404 },
    );
  }

  const activeStoreCount = client.stores.length;
  const locationsFeeTotal = sumLocationFees(client.stores);
  const discount =
    parsed.data.discount ??
    suggestedReferralDiscount(client.referrals.length);
  const amountPaid = paymentAmount(locationsFeeTotal, discount);

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
      feePerStore: locationsFeeTotal,
      discount,
      amountPaid,
      notes: parsed.data.notes,
    },
    update: {
      activeStoreCount,
      feePerStore: locationsFeeTotal,
      discount,
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
      feePerStore: locationsFeeTotal,
      discount,
      amountPaid,
      notes: parsed.data.notes,
    }),
  );

  return NextResponse.json({ payment }, { status: 201 });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const { searchParams } = new URL(request.url);
  const clientId = (searchParams.get("clientId") ?? "").trim();
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!clientId || !year || !month) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  try {
    await db.payment.delete({
      where: {
        clientId_year_month: { clientId, year, month },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }
}
