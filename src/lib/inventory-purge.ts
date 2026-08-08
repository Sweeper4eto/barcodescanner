import { db } from "@/lib/db";
import { purgeOrphanedLocalProducts } from "@/lib/local-product";

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * Hard-delete inventory rows the user removed from the expiry list once
 * `removedAt` is at least ~1 month old. Does not delete by expiry date.
 *
 * Also clears legacy auto-purge soft-deletes (`deletedAt` only) so those
 * rows stay visible under the "All" filter, and drops unused no-barcode
 * (local) products so they never accumulate in the shared catalog.
 */
export async function purgeExpiredInventory(): Promise<number> {
  await db.inventoryEntry.updateMany({
    where: {
      deletedAt: { not: null },
      removedAt: null,
    },
    data: { deletedAt: null },
  });

  const cutoff = new Date(Date.now() - ONE_MONTH_MS);
  const result = await db.inventoryEntry.deleteMany({
    where: {
      removedAt: { not: null, lt: cutoff },
    },
  });

  await purgeOrphanedLocalProducts();

  return result.count;
}
