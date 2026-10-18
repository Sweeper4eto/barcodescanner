import { db } from "@/lib/db";
import { userCanAccessStore } from "@/lib/store-access";
import { isSafeUploadFilename, readUploadOwner } from "@/lib/upload";

/**
 * Who may load a photo:
 * - an admin
 * - any logged-in user, when the file is a shared catalog picture
 * - a member of a store that has this file on an expiry row
 * - the person who just uploaded it, until it is saved on a product or a row
 */
export async function canViewUpload(
  userId: string,
  role: string,
  filename: string,
): Promise<boolean> {
  if (!isSafeUploadFilename(filename)) return false;
  if (role === "ADMIN") return true;

  const imagePath = `/uploads/${filename}`;
  const [product, entries, owner] = await Promise.all([
    db.product.findFirst({
      where: { imagePath },
      select: { id: true },
    }),
    db.inventoryEntry.findMany({
      where: { imagePath },
      select: { storeId: true },
    }),
    readUploadOwner(filename),
  ]);

  if (product) return true;

  const storeIds = [...new Set(entries.map((entry) => entry.storeId))];
  for (const storeId of storeIds) {
    if (await userCanAccessStore(userId, storeId)) return true;
  }

  return owner === userId;
}
