/**
 * Account / store roles on User.clientRole.
 *
 * OWNER — whole account: all linked stores, Team, Billing, Analytics, schedule settings.
 * STORE_MANAGER — owner-like only in assigned stores; no Billing; not auto-linked to new stores.
 * MEMBER — staff in assigned stores.
 */

export const CLIENT_ROLES = ["OWNER", "STORE_MANAGER", "MEMBER"] as const;
export type AppClientRole = (typeof CLIENT_ROLES)[number];

export function isAppClientRole(value: unknown): value is AppClientRole {
  return (
    typeof value === "string" &&
    (CLIENT_ROLES as readonly string[]).includes(value)
  );
}

/** True account owner (billing, account-wide settings, last-owner rules). */
export function isAccountOwner(role: string | null | undefined): boolean {
  return role === "OWNER";
}

/**
 * Owner-like for store operations: Tasks admin, schedule edit, analytics,
 * Team (scoped for store managers), always may remove expiry.
 */
export function isStoreManagerLike(role: string | null | undefined): boolean {
  return role === "OWNER" || role === "STORE_MANAGER";
}

/** Bulk-remove selection uses the higher owner/manager cap. */
export function usesOwnerBulkRemoveLimit(
  role: string | null | undefined,
): boolean {
  return isStoreManagerLike(role);
}
