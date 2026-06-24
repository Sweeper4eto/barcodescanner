import { db } from "@/lib/db";

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 183;

export async function purgeExpiredInventory(): Promise<number> {
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS);
  const result = await db.inventoryEntry.updateMany({
    where: {
      deletedAt: null,
      expiryDate: { lt: cutoff },
    },
    data: { deletedAt: new Date() },
  });
  return result.count;
}
