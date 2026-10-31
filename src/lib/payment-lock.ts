/** App paths owners may use while the account is payment-locked. */
export function isPathAllowedWhenPaymentLocked(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === "/app/billing" || path.startsWith("/app/billing/")) {
    return true;
  }
  if (path === "/app/contact" || path.startsWith("/app/contact/")) {
    return true;
  }
  return false;
}
