/** Shared display helpers for admin + owner activity log UIs. */

export function extractAuditStoreName(details: string): string | null {
  const match = /store "([^"]+)"/.exec(details);
  const name = match?.[1]?.trim();
  return name || null;
}

export function formatAuditCompactWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${min}`;
}
