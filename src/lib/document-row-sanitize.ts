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
 * When OCR zips the Godnost column one row too high, every name gets the
 * *next* row's date and the last row is left blank:
 *   true:  [null, D2, D3, D4]
 *   OCR:   [D2,   D3, D4, null]
 * Repair: shift dates down by one (quantities untouched).
 *
 * Detected only when exactly one row lacks a date and it is the last row,
 * and the first row still has a date (the stolen one).
 */
export function repairUpwardExpiryColumnShift(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;
  if (rows[rows.length - 1].expiryYmd) return rows;
  if (!rows[0].expiryYmd) return rows;

  let dated = 0;
  for (const row of rows) {
    if (row.expiryYmd) dated += 1;
  }
  if (dated !== rows.length - 1) return rows;

  const extracted = rows.map((row) => row.expiryYmd);
  return rows.map((row, index) => ({
    ...row,
    expiryYmd: index === 0 ? null : extracted[index - 1],
  }));
}

/**
 * If the first two rows share an identical date, clear the first — OCR often
 * duplicates the 2nd Godnost onto a blank 1st cell without shifting the rest.
 */
export function clearPageLeadingDuplicateExpiry(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;
  const first = rows[0];
  const second = rows[1];
  if (!first.expiryYmd || !second.expiryYmd) return rows;
  if (first.expiryYmd !== second.expiryYmd) return rows;
  return rows.map((row, index) =>
    index === 0 ? { ...row, expiryYmd: null } : row,
  );
}

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  const cleaned = rows.map(sanitizeDocumentRow);
  const withoutFragments = repairFragmentRowAlignment(cleaned);
  const withoutOrphans = dropOrphanNameFragments(withoutFragments);
  const shifted = repairUpwardExpiryColumnShift(withoutOrphans);
  return clearPageLeadingDuplicateExpiry(shifted);
}
