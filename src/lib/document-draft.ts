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
  matchSource: "barcode" | "name" | "articul" | null;
};

/** One uploaded/captured photo and the OCR rows from it (multi-doc review). */
export type DocumentPageDraft = {
  id: string;
  /** Display label — file name or "Page N". */
  label: string;
  imageDataUrl: string;
  status: "ready" | "processing" | "failed";
  items: DocumentDraftItem[];
  error?: string | null;
};

export function flattenDocumentPageItems(
  pages: DocumentPageDraft[],
): DocumentDraftItem[] {
  return pages.flatMap((page) => page.items);
}

/** Mark one page as OCR-in-progress; keeps array order and other pages untouched. */
export function markDocumentPageProcessing(
  pages: DocumentPageDraft[],
  pageId: string,
): DocumentPageDraft[] {
  return pages.map((page) =>
    page.id === pageId
      ? { ...page, status: "processing", error: null }
      : page,
  );
}

/** Restore ready + error after a failed retake/reattach (old items kept). */
export function setDocumentPageError(
  pages: DocumentPageDraft[],
  pageId: string,
  error: string,
): DocumentPageDraft[] {
  return pages.map((page) =>
    page.id === pageId
      ? { ...page, status: "ready", error }
      : page,
  );
}

/**
 * Replace one page's image + OCR rows in place (same index / id).
 * Other pages are unchanged — used by Retake / Reattach.
 */
export function replaceDocumentPageContent(
  pages: DocumentPageDraft[],
  pageId: string,
  next: {
    imageDataUrl: string;
    items: DocumentDraftItem[];
    label?: string;
  },
): DocumentPageDraft[] {
  return pages.map((page) =>
    page.id === pageId
      ? {
          ...page,
          imageDataUrl: next.imageDataUrl,
          label: next.label?.trim() || page.label,
          items: next.items,
          status: "ready" as const,
          error: null,
        }
      : page,
  );
}

export function updateDocumentPageItem(
  pages: DocumentPageDraft[],
  itemKey: string,
  patch: Partial<DocumentDraftItem>,
): DocumentPageDraft[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.map((item) =>
      item.key === itemKey ? { ...item, ...patch } : item,
    ),
  }));
}

export function removeDocumentPageItem(
  pages: DocumentPageDraft[],
  itemKey: string,
): DocumentPageDraft[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => item.key !== itemKey),
  }));
}

export function removeDocumentPagesItemsWithoutExpiry(
  pages: DocumentPageDraft[],
): DocumentPageDraft[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => !draftMissingExpiry(item)),
  }));
}

/** Pages that still have at least one row matching search (empty search → all). */
export function filterDocumentPagesBySearch(
  pages: DocumentPageDraft[],
  needle: string,
): DocumentPageDraft[] {
  const q = needle.trim();
  if (!q) return pages;
  return pages.filter((page) =>
    page.items.some((item) => draftMatchesSearch(item, q)),
  );
}

/** Ready to import: every page idle, at least one row, all rows valid. */
export function documentPagesCanImport(pages: DocumentPageDraft[]): boolean {
  if (pages.length === 0) return false;
  if (pages.some((page) => page.status !== "ready")) return false;
  const items = flattenDocumentPageItems(pages);
  return items.length > 0 && items.every((item) => draftItemValid(item));
}

export type DocumentDraftWarning =
  | "invalidBarcode"
  | "expiryPast"
  | "expiryFarFuture"
  | "quantityHigh"
  | "possibleRowShift";

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

function nameWordCount(name: string): number {
  return name.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Detects a specific OCR failure mode: a stray single-word name (a leftover
 * fragment from a wrapped/cut-off row) ends up with the exact same quantity
 * and expiry date as the full, multi-word product right next to it — a
 * strong signal that a row's numbers were duplicated/borrowed by mistake
 * rather than the two rows genuinely being separate products that happen
 * to share a date. Only flags the short/fragment-looking side of the pair.
 */
export function computeRowShiftWarningKeys(
  items: DocumentDraftItem[],
): Set<string> {
  const flagged = new Set<string>();

  for (let index = 0; index < items.length - 1; index += 1) {
    const a = items[index];
    const b = items[index + 1];
    if (draftHasMissingInfo(a) || draftHasMissingInfo(b)) continue;
    if (a.expiryYmd !== b.expiryYmd) continue;
    if (a.quantity !== b.quantity) continue;
    if (a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) continue;

    const aWords = nameWordCount(a.name);
    const bWords = nameWordCount(b.name);
    if (aWords === 1 && bWords >= 2) {
      flagged.add(a.key);
    } else if (bWords === 1 && aWords >= 2) {
      flagged.add(b.key);
    }
  }

  return flagged;
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
