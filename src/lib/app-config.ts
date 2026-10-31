import { db } from "@/lib/db";
import {
  expectedPaymentAmount,
  qualifyingReferralInclude,
  sumLocationFees,
} from "@/lib/location-fees";
import {
  billingStartPeriod,
  isPaymentAccessBlocked,
  periodFromDate,
  periodKey,
} from "@/lib/payment-status";

export function currentBillingPeriod(now = new Date()): { year: number; month: number } {
  return periodFromDate(now);
}

/**
 * True when this client is locked out for overdue payment.
 * Requires payments ON, positive fee, and at least one unpaid month
 * *before* the current calendar month (current month stays payable anytime).
 */
export async function clientRequiresPayment(
  clientId: string,
  now = new Date(),
): Promise<boolean> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      active: true,
      homeUser: true,
      paymentsRequired: true,
      paymentsRequiredSince: true,
      createdAt: true,
      updatedAt: true,
      stores: { where: { active: true }, select: { monthlyFee: true } },
      payments: { select: { year: true, month: true } },
      referrals: qualifyingReferralInclude,
    },
  });
  if (!client?.active) return false;

  const expectedAmount = expectedPaymentAmount(
    sumLocationFees(client.stores),
    client.referrals.length,
  );
  const billingStart = billingStartPeriod({
    paymentsRequired: client.paymentsRequired,
    paymentsRequiredSince: client.paymentsRequiredSince,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
    now,
  });
  const paidKeys = new Set(
    client.payments.map((p) => periodKey(p.year, p.month)),
  );

  return isPaymentAccessBlocked({
    homeUser: client.homeUser,
    paymentsRequired: client.paymentsRequired,
    expectedAmount,
    billingStart,
    current: periodFromDate(now),
    paidKeys,
  });
}
