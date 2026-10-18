/**
 * Older builds copied the login token into a JS-readable cookie and
 * sessionStorage. Logout still expires that leftover so a page script cannot
 * read it.
 */
export async function clearClientSession(): Promise<void> {
  try {
    // Dynamic import keeps the token/jose module out of the initial bundle.
    const { CLIENT_COOKIE_NAME } = await import("@/lib/session-token");
    const { clearCachedHomeUser } = await import("@/lib/home-user-cache");
    document.cookie = `${CLIENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    sessionStorage.removeItem(CLIENT_COOKIE_NAME);
    clearCachedHomeUser();
  } catch {
    /* ignore */
  }
}

export async function logoutSession(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  await clearClientSession();
}
