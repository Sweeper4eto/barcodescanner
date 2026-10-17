/** Case-insensitive alphabetical compare (numeric-aware). */
export function compareAlpha(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareAlpha(a.name, b.name));
}

export function sortByLabel<T extends { label: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => compareAlpha(a.label, b.label));
}

export function sortByUsername<T extends { username: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => compareAlpha(a.username, b.username));
}

/**
 * Keep `pinned` values at the top (original order), sort the rest by `label`.
 */
export function sortLabelsPinnedFirst<T extends { value: string; label: string }>(
  items: readonly T[],
  pinnedValues: readonly string[],
): T[] {
  if (pinnedValues.length === 0) return sortByLabel(items);
  const pinned = new Set(pinnedValues);
  const head: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (pinned.has(item.value)) head.push(item);
    else rest.push(item);
  }
  return [...head, ...sortByLabel(rest)];
}
