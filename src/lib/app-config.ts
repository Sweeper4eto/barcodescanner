import { paymentAmount } from "@/lib/expiry";
import { db } from "@/lib/db";

export function currentBillingPeriod(now = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * True when this client must have a Payment row for the current calendar month.
 * Households, clients with payments off, and zero/negative expected fee never require payment.
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
      monthlyFeePerStore: true,
      stores: { where: { active: true }, select: { id: true } },
    },
  });
  if (!client?.active || client.homeUser || !client.paymentsRequired) {
    return false;
  }

  const expectedAmount = paymentAmount(
    client.stores.length,
    client.monthlyFeePerStore,
    0,
  );
  if (expectedAmount <= 0) return false;

  const { year, month } = currentBillingPeriod(now);
  const payment = await db.payment.findUnique({
    where: {
      clientId_year_month: { clientId, year, month },
    },
    select: { id: true },
  });
  return !payment;
}
