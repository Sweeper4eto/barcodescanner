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
  // Two very short tokens without digits (e.g. brand crumbs), not real products.
  if (words.length === 2 && name.length <= 16 && !/\d/.test(name)) return true;
  return false;
}

function hasExpiry(row: DocumentOcrRow): boolean {
  return Boolean(row.expiryYmd);
}

function sameQtyAndExpiry(a: DocumentOcrRow, b: DocumentOcrRow): boolean {
  return (
    a.quantity === b.quantity &&
    Boolean(a.expiryYmd) &&
    a.expiryYmd === b.expiryYmd
  );
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
 * Drop leftover name fragments that OCR invented at page edges.
 *
 * Never copies quantity/expiry from one row onto another — blank Godnost
 * must stay blank so a neighboring date cannot "slide" onto the wrong item.
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

    // Fragment duplicates the next row's qty+date — leftover paired onto both.
    if (hasExpiry(current) && sameQtyAndExpiry(current, next)) {
      out.splice(i, 1);
      continue;
    }

    // Fragment word is clearly part of the next product name.
    if (nameLooselyContainedIn(current.name, next.name)) {
      out.splice(i, 1);
      continue;
    }

    // Fragment with a date sitting above a real product that has no date:
    // almost always a stolen pairing. Drop the fragment only — do NOT move
    // its date onto the next row (that row may legitimately have blank Godnost).
    if (
      hasExpiry(current) &&
      !hasExpiry(next) &&
      (Boolean(next.barcode) ||
        Boolean(next.articul) ||
        nameWords(next.name).length >= 2 ||
        next.name.trim().length > current.name.trim().length)
    ) {
      out.splice(i, 1);
      continue;
    }

    i += 1;
  }

  return out;
}

/**
 * Drop leftover crumbs that never got (and never should get) their own
 * quantity/date — a single orphan word with defaults only.
 * Keep longer name-only rows; those can be real products missing Godnost.
 */
export function dropOrphanNameFragments(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  return rows.filter((row) => {
    if (!isLikelyNameFragment(row)) return true;
    if (hasExpiry(row)) return true;
    if (row.quantity !== 1) return true;
    return nameWords(row.name).length > 1;
  });
}

/**
 * When two adjacent real products share the exact same qty+expiry and the
 * upper one has no SKU/barcode while the lower one does, clear the upper
 * date/qty defaults — OCR often copied the lower row's Godnost upward onto
 * a blank cell. Prefer leaving blank over a wrong date.
 */
export function clearUpwardCopiedExpiry(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  if (rows.length < 2) return rows;
  const out = rows.map((row) => ({ ...row }));

  for (let i = 0; i < out.length - 1; i += 1) {
    const current = out[i];
    const next = out[i + 1];
    if (!hasExpiry(current) || !sameQtyAndExpiry(current, next)) continue;
    if (current.barcode || current.articul) continue;
    if (!next.barcode && !next.articul) continue;
    // Upper row looks weaker (no identity fields) and shares next's numbers.
    current.expiryYmd = null;
    current.quantity = 1;
  }

  return out;
}

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  const cleaned = rows.map(sanitizeDocumentRow);
  const withoutFragments = repairFragmentRowAlignment(cleaned);
  const withoutOrphans = dropOrphanNameFragments(withoutFragments);
  return clearUpwardCopiedExpiry(withoutOrphans);
}
