import * as XLSX from "xlsx";
import { isSpreadsheetMime } from "@/lib/document-upload-types";

/**
 * Turn spreadsheet / CSV bytes into plain text for Gemini OCR.
 * First sheet only; capped so the prompt stays manageable.
 */
export function spreadsheetBytesToText(
  buffer: Buffer,
  mime: string,
): string {
  if (!isSpreadsheetMime(mime)) {
    throw new Error("UNSUPPORTED_DOCUMENT_TYPE");
  }

  const normalized = mime.toLowerCase().split(";")[0].trim();
  if (
    normalized === "text/csv" ||
    normalized === "text/plain" ||
    normalized === "text/tab-separated-values"
  ) {
    return buffer.toString("utf8").slice(0, 400_000);
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "";
  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  return csv.slice(0, 400_000);
}
