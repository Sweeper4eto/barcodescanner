import { Prisma } from "@/generated/prisma/client";

/**
 * SQLite LIKE / LOWER only fold ASCII A–Z. Bulgarian Cyrillic stays
 * case-sensitive there. JS toLowerCase handles Unicode; use it for
 * in-memory match, or sqlFoldColumn for raw SQL LIKE.
 */

/** Bulgarian + common Cyrillic uppercase that SQLite will not fold. */
const CYRILLIC_UPPER =
  "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЇІЄҐЎ";
const CYRILLIC_LOWER =
  "абвгдеёжзийклмнопрстуфхцчшщъьюяїієґў";

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function searchTextIncludes(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  const n = normalizeSearchText(needle);
  if (!n) return true;
  if (!haystack) return false;
  return normalizeSearchText(haystack).includes(n);
}

/**
 * Trusted SQL identifier only (e.g. `name`, `Product.name`).
 * LOWER() for ASCII + REPLACE chain for Cyrillic uppercase.
 */
export function sqlFoldColumn(column: string): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(column)) {
    throw new Error("sqlFoldColumn: invalid column identifier");
  }
  let expr = `LOWER(${column})`;
  for (let i = 0; i < CYRILLIC_UPPER.length; i++) {
    const from = CYRILLIC_UPPER[i];
    const to = CYRILLIC_LOWER[i];
    expr = `REPLACE(${expr}, '${from}', '${to}')`;
  }
  return Prisma.raw(expr);
}

/** LIKE pattern for a needle already passed through normalizeSearchText. */
export function sqlContainsPattern(normalizedNeedle: string): string {
  return `%${normalizedNeedle}%`;
}

export function sqlPrefixPattern(normalizedNeedle: string): string {
  return `${normalizedNeedle}%`;
}
