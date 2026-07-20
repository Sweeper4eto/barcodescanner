export type DocumentDraftItem = {
  key: string;
  name: string;
  barcode: string;
  articul: string;
  expiryYmd: string;
  quantity: string;
  productId: string | null;
  productImagePath: string | null;
  matchSource: "barcode" | "articul" | "name" | null;
};

export function draftMissingName(item: DocumentDraftItem): boolean {
  return !item.name.trim();
}

export function draftMissingExpiry(item: DocumentDraftItem): boolean {
  return !/^\d{4}-\d{2}-\d{2}$/.test(item.expiryYmd);
}

export function draftHasMissingInfo(item: DocumentDraftItem): boolean {
  return draftMissingName(item) || draftMissingExpiry(item);
}

export function draftItemValid(item: DocumentDraftItem): boolean {
  const qty = Number(item.quantity);
  return (
    !draftHasMissingInfo(item) &&
    Number.isInteger(qty) &&
    qty >= 1
  );
}

export function draftMatchesSearch(
  item: DocumentDraftItem,
  needle: string,
): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return (
    item.name.toLowerCase().includes(q) ||
    item.barcode.toLowerCase().includes(q) ||
    item.articul.toLowerCase().includes(q)
  );
}
