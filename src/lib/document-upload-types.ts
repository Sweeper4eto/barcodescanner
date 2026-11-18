/**
 * Shared helpers for document scan uploads (photos + PDF/spreadsheet files).
 * Safe for client and server.
 */

export const DOCUMENT_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

/** System file picker — user can open Downloads / Files / Drive. */
export const DOCUMENT_FILE_ACCEPT = [
  "application/pdf",
  ".pdf",
  "text/csv",
  ".csv",
  "text/plain",
  ".txt",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls",
  ".xlsx",
].join(",");

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function mimeFromFilename(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "pdf":
      return "application/pdf";
    case "csv":
      return "text/csv";
    case "txt":
      return "text/plain";
    case "tsv":
      return "text/tab-separated-values";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return null;
  }
}

export function isImageMime(mime: string): boolean {
  return IMAGE_TYPES.has(mime.toLowerCase().split(";")[0].trim());
}

export function isDocumentFileMime(mime: string): boolean {
  return DOCUMENT_TYPES.has(mime.toLowerCase().split(";")[0].trim());
}

export function isSpreadsheetMime(mime: string): boolean {
  const m = mime.toLowerCase().split(";")[0].trim();
  return (
    m === "text/csv" ||
    m === "text/tab-separated-values" ||
    m === "text/plain" ||
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function isAcceptedImageFile(file: File): boolean {
  if (file.type && isImageMime(file.type)) return true;
  const fromName = mimeFromFilename(file.name);
  return Boolean(fromName && isImageMime(fromName));
}

export function isAcceptedDocumentFile(file: File): boolean {
  if (file.type && isDocumentFileMime(file.type)) return true;
  const fromName = mimeFromFilename(file.name);
  return Boolean(fromName && isDocumentFileMime(fromName));
}

export function isImageDataUrl(dataUrl: string): boolean {
  return /^data:image\//i.test(dataUrl.trim());
}

export function dataUrlMime(dataUrl: string): string | null {
  const match = /^data:([^;]+);/i.exec(dataUrl.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** Fix empty/wrong browser MIME so OCR gets application/pdf etc. */
export function ensureDataUrlMime(dataUrl: string, fileName: string): string {
  const mime = dataUrlMime(dataUrl);
  const fromName = mimeFromFilename(fileName);
  if (!fromName) return dataUrl;
  if (!mime || mime === "application/octet-stream") {
    return dataUrl.replace(/^data:[^;]+/, `data:${fromName}`);
  }
  return dataUrl;
}
