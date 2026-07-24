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
 * page-boundary word, or a name-only line that later stole the next row's
 * quantity/date.
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
  // Also treat accent/case-folded token overlap for short leftovers.
  const fragWords = nameWords(left);
  if (fragWords.length !== 1) return false;
  return nameWords(right).some((word) => word === fragWords[0]);
}

/**
 * When OCR turns a leftover single-word line into an item and pairs it with
 * the next product's pcs/Godnost, the quantity+date column effectively shifts
 * up by one until a later real product is left without an expiry.
 *
 * Repair: shift qty/expiry back down onto the incomplete row, then drop the
 * fragment. Barcode/articul stay with their names (they usually did not shift).
 */
export function repairFragmentRowAlignment(
  rows: DocumentOcrRow[],
): DocumentOcrRow[] {
  if (rows.length < 2) return rows;

  const out = rows.map((row) => ({ ...row }));
  let i = 0;
  while (i < out.length - 1) {
    const current = out[i];
    if (!isLikelyNameFragment(current) || !hasExpiry(current)) {
      i += 1;
      continue;
    }

    const next = out[i + 1];

    // Fragment duplicates the next row's qty+date — leftover paired onto both.
    if (sameQtyAndExpiry(current, next)) {
      out.splice(i, 1);
      continue;
    }

    // Fragment word is clearly part of the next product name.
    if (nameLooselyContainedIn(current.name, next.name)) {
      if (!hasExpiry(next)) {
        next.quantity = current.quantity;
        next.expiryYmd = current.expiryYmd;
      }
      out.splice(i, 1);
      continue;
    }

    // Find the first later row missing an expiry — classic upward shift.
    let incompleteAt = -1;
    for (let k = i + 1; k < out.length; k += 1) {
      const candidate = out[k];
      if (!candidate.name.trim() && !candidate.barcode && !candidate.articul) {
        continue;
      }
      if (!hasExpiry(candidate)) {
        incompleteAt = k;
        break;
      }
      // Stop if we hit another fragment mid-chain; keep search local.
      if (k > i + 1 && isLikelyNameFragment(candidate)) break;
    }

    if (incompleteAt > i) {
      // All rows between fragment and the incomplete one must have expiries
      // (the shifted values). Already true by search order.
      for (let j = incompleteAt; j > i; j -= 1) {
        out[j].quantity = out[j - 1].quantity;
        out[j].expiryYmd = out[j - 1].expiryYmd;
      }
      out.splice(i, 1);
      continue;
    }

    // Immediate next row incomplete and looks like a real product line.
    if (
      !hasExpiry(next) &&
      (Boolean(next.barcode) ||
        Boolean(next.articul) ||
        nameWords(next.name).length >= 2 ||
        next.name.trim().length > current.name.trim().length)
    ) {
      next.quantity = current.quantity;
      next.expiryYmd = current.expiryYmd;
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
    // Single-token leftover with nothing else — discard.
    return nameWords(row.name).length > 1;
  });
}

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  const cleaned = rows.map(sanitizeDocumentRow);
  const realigned = repairFragmentRowAlignment(cleaned);
  return dropOrphanNameFragments(realigned);
}
