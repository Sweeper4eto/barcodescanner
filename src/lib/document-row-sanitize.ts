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

export function sanitizeDocumentRows(rows: DocumentOcrRow[]): DocumentOcrRow[] {
  return rows.map(sanitizeDocumentRow);
}