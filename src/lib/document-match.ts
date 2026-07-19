import { Prisma } from "@/generated/prisma/client";
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

type ProductSelect = MatchedProduct;

function draftFromRow(
  row: DocumentOcrRow,
  product: MatchedProduct | null,
  matchSource: DocumentDraftItem["matchSource"],
): DocumentDraftItem {
  return {
    name: product?.name || row.name,
    barcode:
      product?.barcode ||
      (row.barcode ? normalizeBarcode(row.barcode) || row.barcode : null),
    articul: row.articul,
    expiryYmd: row.expiryYmd,
    quantity: row.quantity,
    productId: product?.id ?? null,
    productImagePath: product?.imagePath ?? null,
    matchSource,
  };
}

async function loadProductsByBarcodes(
  barcodes: string[],
): Promise<Map<string, ProductSelect>> {
  const lookup = new Map<string, ProductSelect>();
  if (barcodes.length === 0) return lookup;

  const products = await db.product.findMany({
    where: { barcode: { in: barcodes } },
    select: { id: true, name: true, imagePath: true, barcode: true },
  });

  for (const product of products) {
    for (const value of barcodeLookupValues(product.barcode)) {
      if (!lookup.has(value)) lookup.set(value, product);
    }
  }
  return lookup;
}

async function loadProductsByArticuls(
  storeId: string,
  articuls: string[],
): Promise<Map<string, ProductSelect>> {
  const lookup = new Map<string, ProductSelect>();
  if (articuls.length === 0) return lookup;

  const entries = await db.inventoryEntry.findMany({
    where: {
      storeId,
      articul: { in: articuls },
      ...activeInventoryWhere,
    },
    orderBy: { enteredAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, imagePath: true, barcode: true },
      },
    },
  });

  for (const entry of entries) {
    const key = entry.articul?.trim();
    if (!key || lookup.has(key) || !entry.product) continue;
    lookup.set(key, entry.product);
  }
  return lookup;
}

async function loadProductsByNames(
  names: string[],
): Promise<Map<string, ProductSelect>> {
  const lookup = new Map<string, ProductSelect>();
  if (names.length === 0) return lookup;

  const products = await db.$queryRaw<ProductSelect[]>`
    SELECT id, name, imagePath, barcode
    FROM Product
    WHERE lower(name) IN (${Prisma.join(names.map((n) => n.toLowerCase()))})
  `;

  for (const product of products) {
    const key = product.name.trim().toLowerCase();
    if (!lookup.has(key)) lookup.set(key, product);
  }
  return lookup;
}

function resolveRow(
  row: DocumentOcrRow,
  byBarcode: Map<string, ProductSelect>,
  byArticul: Map<string, ProductSelect>,
  byName: Map<string, ProductSelect>,
): DocumentDraftItem {
  let product: ProductSelect | null = null;
  let matchSource: DocumentDraftItem["matchSource"] = null;

  if (row.barcode) {
    for (const value of barcodeLookupValues(row.barcode)) {
      const hit = byBarcode.get(value);
      if (hit) {
        product = hit;
        matchSource = "barcode";
        break;
      }
    }
  }

  if (!product && row.articul) {
    const hit = byArticul.get(row.articul.trim());
    if (hit) {
      product = hit;
      matchSource = "articul";
    }
  }

  if (!product && row.name) {
    const hit = byName.get(row.name.trim().toLowerCase());
    if (hit) {
      product = hit;
      matchSource = "name";
    }
  }

  return draftFromRow(row, product, matchSource);
}

/** Match one OCR row (uses the batched path under the hood). */
export async function matchDocumentRow(
  storeId: string,
  row: DocumentOcrRow,
): Promise<DocumentDraftItem> {
  const [item] = await matchDocumentRows(storeId, [row]);
  return item;
}

/**
 * Match many OCR rows with a few batch queries instead of N sequential
 * lookups (each of which previously scanned Product for lower(name)).
 */
export async function matchDocumentRows(
  storeId: string,
  rows: DocumentOcrRow[],
): Promise<DocumentDraftItem[]> {
  if (rows.length === 0) return [];

  const barcodeValues = new Set<string>();
  const articuls = new Set<string>();
  const names = new Set<string>();

  for (const row of rows) {
    if (row.barcode) {
      for (const value of barcodeLookupValues(row.barcode)) {
        barcodeValues.add(value);
      }
    }
    const articul = row.articul?.trim();
    if (articul) articuls.add(articul);
    const name = row.name?.trim();
    if (name) names.add(name);
  }

  const [byBarcode, byArticul, byName] = await Promise.all([
    loadProductsByBarcodes([...barcodeValues]),
    loadProductsByArticuls(storeId, [...articuls]),
    loadProductsByNames([...names]),
  ]);

  return rows.map((row) => resolveRow(row, byBarcode, byArticul, byName));
}
