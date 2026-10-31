import { createHmac } from "crypto";

/** Crockford base32 without I, L, O, U — clearer on bank statements. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function paymentRefSecret(): string {
  const dedicated = process.env.PAYMENT_REF_SECRET?.trim();
  if (dedicated && dedicated.length >= 16) return dedicated;
  const session = process.env.SESSION_SECRET?.trim();
  if (session && session.length >= 16) return session;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_REF_SECRET or SESSION_SECRET must be set (min 16 chars)",
    );
  }
  return "dev-payment-ref-secret";
}

function hmacBytes(message: string): Buffer {
  return createHmac("sha256", paymentRefSecret()).update(message).digest();
}

function encodeBase32(bytes: Buffer, length: number): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && out.length < length) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]!;
      bits -= 5;
    }
    if (out.length >= length) break;
  }
  while (out.length < length) {
    out += ALPHABET[0]!;
  }
  return out;
}

function periodStamp(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

/**
 * Stable bank "основание" / payment reference for one client + calendar month.
 * Format: E365-{client4}-{YYYYMM}-{check4} (e.g. E365-K7M2-202610-P9QX).
 */
export function paymentReferenceFor(
  clientId: string,
  year: number,
  month: number,
): string {
  const period = periodStamp(year, month);
  const clientPart = encodeBase32(hmacBytes(`client:${clientId}`), 4);
  const checkPart = encodeBase32(
    hmacBytes(`ref:${clientId}:${period}`),
    4,
  );
  return `E365-${clientPart}-${period}-${checkPart}`;
}

/** True when the string matches the expected reference for that client/month. */
export function matchesPaymentReference(
  reference: string,
  clientId: string,
  year: number,
  month: number,
): boolean {
  const normalized = reference.trim().toUpperCase();
  return normalized === paymentReferenceFor(clientId, year, month);
}

const PAYMENT_REF_PATTERN =
  /^E365-([0-9A-HJKMNP-TV-Z]{4})-(\d{6})-([0-9A-HJKMNP-TV-Z]{4})$/i;

export type ParsedPaymentReference = {
  clientPart: string;
  year: number;
  month: number;
  checkPart: string;
};

/** Parse a full E365-… основание; null if the shape is wrong. */
export function parsePaymentReference(
  raw: string,
): ParsedPaymentReference | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = PAYMENT_REF_PATTERN.exec(normalized);
  if (!match) return null;
  const period = match[2]!;
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return {
    clientPart: match[1]!,
    year,
    month,
    checkPart: match[3]!,
  };
}

export function looksLikePaymentReference(raw: string): boolean {
  return parsePaymentReference(raw) != null;
}

/**
 * Find which client owns this reference for the month encoded in it.
 * Scans client ids (HMAC is not reversible).
 */
export function resolvePaymentReference(
  reference: string,
  clientIds: readonly string[],
): { clientId: string; year: number; month: number } | null {
  const parsed = parsePaymentReference(reference);
  if (!parsed) return null;
  for (const clientId of clientIds) {
    if (
      matchesPaymentReference(reference, clientId, parsed.year, parsed.month)
    ) {
      return { clientId, year: parsed.year, month: parsed.month };
    }
  }
  return null;
}
