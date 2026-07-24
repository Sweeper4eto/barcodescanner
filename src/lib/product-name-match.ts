/**
 * Normalizes a product name for "is this basically the same name" checks used
 * when deciding whether to merge a scanned document row into an existing
 * catalog product. Strips punctuation/symbol noise (commas, dots, %, etc.)
 * and collapses whitespace, but keeps every letter and digit as-is — a real
 * difference in words or numbers must never be treated as a match, only
 * formatting/punctuation noise should be ignored.
 */
export function normalizeProductNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when two names are identical once punctuation/symbol noise is
 * stripped (e.g. "Ябълка , 10 % сайдер" vs "Ябълка 10 Сайдер"). Any actual
 * difference in letters or digits (e.g. "5 %" vs "10 %") is NOT a match.
 */
export function namesMatchForMerge(a: string, b: string): boolean {
  const left = normalizeProductNameForMatch(a);
  const right = normalizeProductNameForMatch(b);
  return left.length > 0 && left === right;
}
