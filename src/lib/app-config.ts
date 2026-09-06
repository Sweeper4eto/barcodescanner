import { db } from "@/lib/db";

export type AppConfigRow = {
  paymentsEnabled: boolean;
};

const DEFAULTS: AppConfigRow = {
  paymentsEnabled: false,
};

/** Ensure singleton row exists and return current config. */
export async function getAppConfig(): Promise<AppConfigRow> {
  const row = await db.appConfig.upsert({
    where: { id: 1 },
    create: { id: 1, paymentsEnabled: false },
    update: {},
    select: { paymentsEnabled: true },
  });
  return { paymentsEnabled: row.paymentsEnabled };
}

export async function setPaymentsEnabled(enabled: boolean): Promise<AppConfigRow> {
  const row = await db.appConfig.upsert({
    where: { id: 1 },
    create: { id: 1, paymentsEnabled: enabled },
    update: { paymentsEnabled: enabled },
    select: { paymentsEnabled: true },
  });
  return { paymentsEnabled: row.paymentsEnabled };
}

export function currentBillingPeriod(now = new Date()): { year: number; month: number } {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** True when this client must have a Payment row for the current calendar month. */
export async function clientRequiresPayment(
  clientId: string,
  now = new Date(),
): Promise<boolean> {
  const config = await getAppConfig();
  if (!config.paymentsEnabled) return false;

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { active: true, homeUser: true },
  });
  // Household accounts stay free; inactive clients are gated separately.
  if (!client || !client.active || client.homeUser) return false;

  const { year, month } = currentBillingPeriod(now);
  const payment = await db.payment.findUnique({
    where: {
      clientId_year_month: { clientId, year, month },
    },
    select: { id: true },
  });
  return !payment;
}

export { DEFAULTS as APP_CONFIG_DEFAULTS };
