import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/db";
import type { DocumentOcrRow } from "@/lib/document-ai";
import { activeInventoryWhere } from "@/lib/inventory";

export type MatchedProduct = {
  id: string;
  name: string;
  imagePath: string | null;
  barcode: string;
};

export type DocumentDraftItem = {
  name: string;
  barcode: string | null;
  articul: string | null;
  expiryYmd: string | null;
  quantity: number;
  productId: string | null;
  productImagePath: string | null;
  matchSource: "barcode" | "articul" | "name" | null;
};

async function findProductByBarcode(
  barcode: string,
): Promise<MatchedProduct | null> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;
  const product = await db.product.findFirst({
    where: { barcode: { in: barcodeLookupValues(normalized) } },
    select: { id: true, name: true, imagePath: true, barcode: true },
  });
  return product;
}

async function findProductByArticul(
  storeId: string,
  articul: string,
): Promise<MatchedProduct | null> {
  const trimmed = articul.trim();
  if (!trimmed) return null;
  const entry = await db.inventoryEntry.findFirst({
    where: {
      storeId,
      articul: trimmed,
      ...activeInventoryWhere,
    },
    orderBy: { enteredAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, imagePath: true, barcode: true },
      },
    },
  });
  return entry?.product ?? null;
}

async function findProductByName(name: string): Promise<MatchedProduct | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const exact = await db.$queryRaw<
    Array<{
      id: string;
      name: string;
      imagePath: string | null;
      barcode: string;
    }>
  >`SELECT id, name, imagePath, barcode FROM Product WHERE lower(name) = lower(${trimmed}) LIMIT 1`;

  if (exact[0]) return exact[0];
  return null;
}

export async function matchDocumentRow(
  storeId: string,
  row: DocumentOcrRow,
): Promise<DocumentDraftItem> {
  let product: MatchedProduct | null = null;
  let matchSource: DocumentDraftItem["matchSource"] = null;

  if (row.barcode) {
    product = await findProductByBarcode(row.barcode);
    if (product) matchSource = "barcode";
  }

  if (!product && row.articul) {
    product = await findProductByArticul(storeId, row.articul);
    if (product) matchSource = "articul";
  }

  if (!product && row.name) {
    product = await findProductByName(row.name);
    if (product) matchSource = "name";
  }

  return {
    name: product?.name || row.name,
    barcode: product?.barcode || (row.barcode ? normalizeBarcode(row.barcode) || row.barcode : null),
    articul: row.articul,
    expiryYmd: row.expiryYmd,
    quantity: row.quantity,
    productId: product?.id ?? null,
    productImagePath: product?.imagePath ?? null,
    matchSource,
  };
}

export async function matchDocumentRows(
  storeId: string,
  rows: DocumentOcrRow[],
): Promise<DocumentDraftItem[]> {
  const items: DocumentDraftItem[] = [];
  for (const row of rows) {
    items.push(await matchDocumentRow(storeId, row));
  }
  return items;
}
