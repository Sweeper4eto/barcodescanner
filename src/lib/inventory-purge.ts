import { db } from "@/lib/db";

/**
 * Automatic soft-delete of old expiry dates is disabled so the expiry list
 * "All" filter can show every active row (including past years).
 *
 * Rows previously auto-purged only set `deletedAt` (manual remove uses
 * `removedAt`). Restore those so they reappear under All.
 */
export async function purgeExpiredInventory(): Promise<number> {
  await db.inventoryEntry.updateMany({
    where: {
      deletedAt: { not: null },
      removedAt: null,
    },
    data: { deletedAt: null },
  });
  return 0;
}
