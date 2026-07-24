import { isLikelyInvalidBarcode } from "@/lib/document-row-sanitize";

export type DocumentDraftItem = {
  key: string;
  name: string;
  barcode: string;
  articul: string;
  expiryYmd: string;
  quantity: string;
  productId: string | null;
  productImagePath: string | null;
  matchSource: "barcode" | "name" | null;
};

export type DocumentDraftWarning =
  | "invalidBarcode"
  | "expiryPast"
  | "expiryFarFuture"
  | "quantityHigh";

const FAR_FUTURE_YEARS = 5;
const HIGH_QUANTITY = 200;

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

function parseExpiryUtc(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function draftWarnings(item: DocumentDraftItem): DocumentDraftWarning[] {
  if (draftHasMissingInfo(item)) return [];

  const warnings: DocumentDraftWarning[] = [];

  if (item.barcode.trim() && isLikelyInvalidBarcode(item.barcode)) {
    warnings.push("invalidBarcode");
  }

  const expiry = parseExpiryUtc(item.expiryYmd);
  if (expiry) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (expiry < today) {
      warnings.push("expiryPast");
    } else {
      const farFuture = new Date(today);
      farFuture.setUTCFullYear(farFuture.getUTCFullYear() + FAR_FUTURE_YEARS);
      if (expiry > farFuture) {
        warnings.push("expiryFarFuture");
      }
    }
  }

  const qty = Number(item.quantity);
  if (Number.isInteger(qty) && qty >= HIGH_QUANTITY) {
    warnings.push("quantityHigh");
  }

  return warnings;
}

export function draftHasWarnings(item: DocumentDraftItem): boolean {
  return draftWarnings(item).length > 0;
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
