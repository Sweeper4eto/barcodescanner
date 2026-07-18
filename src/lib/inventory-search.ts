import { barcodeLookupValues, normalizeBarcode } from "@/lib/barcode";

export type InventorySearchEntry = {
  barcode: string;
  articul?: string | null;
  product: { name: string };
};

export function normalizeInventorySearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesInventorySearch(
  entry: InventorySearchEntry,
  query: string,
): boolean {
  const needle = normalizeInventorySearchQuery(query);
  if (!needle) return true;

  const name = entry.product.name.toLowerCase();
  const barcode = entry.barcode.toLowerCase();
  const articul = (entry.articul ?? "").toLowerCase();
  const normalizedBarcode = normalizeBarcode(query)?.toLowerCase() ?? "";

  if (name.includes(needle)) return true;
  if (articul && articul.includes(needle)) return true;

  if (barcode.includes(needle)) return true;

  if (
    normalizedBarcode &&
    barcodeLookupValues(entry.barcode).some((value) =>
      value.toLowerCase().includes(normalizedBarcode),
    )
  ) {
    return true;
  }

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) {
    return true;
  }

  return false;
}

export function filterInventoryEntriesBySearch<T extends InventorySearchEntry>(
  entries: T[],
  query: string,
): T[] {
  const needle = normalizeInventorySearchQuery(query);
  if (!needle) return entries;
  return entries.filter((entry) => matchesInventorySearch(entry, needle));
}
