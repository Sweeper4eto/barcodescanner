/** Normalize decoded text for comparison and storage. */
export function normalizeBarcode(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^\d{12}$/.test(normalized) && !normalized.startsWith("0")) {
    return `0${normalized}`;
  }
  return normalized;
}

function isValidEan13Checksum(digits: number[]): boolean {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += digits[index] * (index % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

function isValidEan8Checksum(digits: number[]): boolean {
  let sum = 0;
  for (let index = 0; index < 7; index += 1) {
    sum += digits[index] * (index % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[7];
}

function isValidUpcAChecksum(digits: number[]): boolean {
  let sum = 0;
  for (let index = 0; index < 11; index += 1) {
    sum += digits[index] * (index % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[11];
}

/** Reject common misreads from curved or blurry labels when checksum applies. */
export function isPlausibleBarcode(value: string): boolean {
  const code = normalizeBarcode(value);
  if (!code) return false;

  if (/^\d{13}$/.test(code)) {
    return isValidEan13Checksum(code.split("").map(Number));
  }
  if (/^\d{12}$/.test(code)) {
    return isValidUpcAChecksum(code.split("").map(Number));
  }
  if (/^\d{8}$/.test(code)) {
    return isValidEan8Checksum(code.split("").map(Number));
  }
  if (/^\d{6,7}$/.test(code)) {
    return true;
  }
  if (/^[0-9A-Z\-\.\ \$\/\+\%]{4,48}$/i.test(code)) {
    return true;
  }

  return code.length >= 4;
}

/** Require repeated identical reads before accepting a scan. */
export class BarcodeReadConsensus {
  private lastCode: string | null = null;
  private streak = 0;

  private requiredMatches(code: string): number {
    if (/^\d{8}$/.test(code) || /^\d{12}$/.test(code) || /^\d{13}$/.test(code)) {
      return 2;
    }
    return 3;
  }

  reset(): void {
    this.lastCode = null;
    this.streak = 0;
  }

  add(raw: string): string | null {
    const code = normalizeBarcode(raw);
    if (!isPlausibleBarcode(code)) {
      this.reset();
      return null;
    }

    if (code === this.lastCode) {
      this.streak += 1;
    } else {
      this.lastCode = code;
      this.streak = 1;
    }

    if (this.streak >= this.requiredMatches(code)) {
      this.reset();
      return code;
    }

    return null;
  }
}

export function barcodeLookupValues(raw: string): string[] {
  const normalized = normalizeBarcode(raw);
  if (!normalized) return [];

  if (!/^\d+$/.test(normalized)) {
    return [normalized];
  }

  const rawDigits = raw.replace(/\D/g, "");
  const values = new Set<string>([normalized]);
  if (rawDigits) {
    values.add(rawDigits);
  }

  for (const code of Array.from(values)) {
    if (code.length === 12 && !code.startsWith("0")) {
      values.add(`0${code}`);
    }
    if (code.length === 13 && code.startsWith("0")) {
      values.add(code.slice(1));
    }
  }

  return [...values];
}
