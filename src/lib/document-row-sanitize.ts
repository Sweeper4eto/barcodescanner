import { isPlausibleBarcode, normalizeBarcode } from "@/lib/barcode";
import type { DocumentOcrRow } from "@/lib/document-ai";

export const MAX_DOCUMENT_QUANTITY = 999;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function looksLikeEan(value: string): boolean {
  const digits = digitsOnly(value);
  return /^\d{8}$|^\d{12}$|^\d{13}$/.test(digits);
}

export function isLikelyInvalidBarcode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!looksLikeEan(trimmed)) return false;
  return !isPlausibleBarcode(normalizeBarcode(digitsOnly(trimmed)));
}

/** Clean OCR output without moving values between barcode and articul. */
export function sanitizeDocumentRow(row: DocumentOcrRow): DocumentOcrRow {
  let { name, barcode, articul, expiryYmd, quantity } = row;

  if (barcode) {
    const trimmed = barcode.trim();
    if (looksLikeEan(trimmed)) {
      barcode = normalizeBarcode(digitsOnly(trimmed));
    } else {
      barcode = trimmed;
    }
  }

  if (articul) {
    articul = articul.trim() || null;
  }

  const qty = Math.round(quantity);
  quantity = Math.min(
    Math.max(Number.isFinite(qty) ? qty : 1, 1),
    MAX_DOCUMENT_QUANTITY,
  );

  return { name, barcode, articul, expiryYmd, quantity };
}

function nameWords(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Short name with no SKU/barcode — typical OCR leftover from a cut-off
 * page-boundary word.
 */
export function isLikelyNameFragment(row: DocumentOcrRow): boolean {
  if (row.barcode || row.articul) return false;
  const name = row.name.trim();
  if (!name) return false;
  const words = nameWords(name);
  if (words.length === 1) return name.length <= 40;
  if (words.length === 2 && name.length <= 16 && !/\d/.test(name)) return true;
  return false;
}

function nameLooselyContainedIn(fragment: string, full: string): boolean {
  const left = fragment.trim().toLowerCase();
  const right = full.trim().toLowerCase();
  if (!left || !right || left === right) return false;
  if (right.includes(left)) return true;
  const fragWords = nameWords(left);
  if (fragWords.length !== 1) return false;
  return nameWords(right).some((word) => word === fragWords[0]);
}

/**
 * Drop leftover name fragments OCR invented at page edges.
 * Does not copy or clear quantity/expiry on any other row — each row keeps
 * only what OCR assigned to it.
 */
export function repairFragmentRowAlignment(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;

  const out = rows.map((row) => ({ ...row }));
  let i = 0;
  while (i < out.length - 1) {
    const current = out[i];
    if (!isLikelyNameFragment(current)) {
      i += 1;
      continue;
    }

    const next = out[i + 1];

    // Fragment word is clearly part of the next product name.
    if (nameLooselyContainedIn(current.name, next.name)) {
      out.splice(i, 1);
      continue;
    }

    // Short leftover sitting above a real product line — drop the crumb only.
    if (
      Boolean(next.barcode) ||
      Boolean(next.articul) ||
      nameWords(next.name).length >= 2 ||
      next.name.trim().length > current.name.trim().length
    ) {
      out.splice(i, 1);
      continue;
    }

    i += 1;
  }

  return out;
}

/**
 * Drop leftover crumbs that never got their own data — a single orphan word
 * with defaults only. Keep longer name-only rows (real products missing Godnost).
 */
export function dropOrphanNameFragments(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  return rows.filter((row) => {
    if (!isLikelyNameFragment(row)) return true;
    if (row.expiryYmd) return true;
    if (row.quantity !== 1) return true;
    return nameWords(row.name).length > 1;
  });
}

/**
 * OCR often bleeds the 2nd printed Godnost onto the 1st row of a page photo
 * (especially after a previous page of blank dates). Each page is sanitized
 * alone, so index 0 is always the top of that photo.
 *
 * - If row0 and row1 share the same date → clear row0 (duplicate copy-up).
 * - If row0 has a date and row1 is blank → move that date onto row1 and clear
 *   row0 (classic one-row upward shift). Quantity is never moved.
 */
export function fixPageLeadingExpiryBleed(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;
  const out = rows.map((row) => ({ ...row }));
  const first = out[0];
  const second = out[1];
  if (!first.expiryYmd) return out;

  if (second.expiryYmd && first.expiryYmd === second.expiryYmd) {
    first.expiryYmd = null;
    return out;
  }

  if (!second.expiryYmd) {
    second.expiryYmd = first.expiryYmd;
    first.expiryYmd = null;
  }

  return out;
}

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  const cleaned = rows.map(sanitizeDocumentRow);
  const withoutFragments = repairFragmentRowAlignment(cleaned);
  const withoutOrphans = dropOrphanNameFragments(withoutFragments);
  return fixPageLeadingExpiryBleed(withoutOrphans);
}
