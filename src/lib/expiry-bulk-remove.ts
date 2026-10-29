/** Max cards removable in one bulk-remove request (and selectable in the UI). */
export const BULK_REMOVE_MAX_OWNER = 150;
export const BULK_REMOVE_MAX_MEMBER = 50;

/** Absolute Zod ceiling — role-specific max is enforced after auth. */
export const BULK_REMOVE_MAX_ABSOLUTE = BULK_REMOVE_MAX_OWNER;

export function bulkRemoveMaxForClientRole(
  clientRole: string | null | undefined,
): number {
  return clientRole === "OWNER" ? BULK_REMOVE_MAX_OWNER : BULK_REMOVE_MAX_MEMBER;
}
