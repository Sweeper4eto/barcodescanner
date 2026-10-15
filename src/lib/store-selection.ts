const LEGACY_STORE_KEY = "magazin_selected_store";
const STORE_KEY_PREFIX = "magazin_selected_store:";

function keyForUsername(username: string): string {
  return `${STORE_KEY_PREFIX}${username.trim().toLowerCase()}`;
}

/**
 * Last selected location. Prefer per-username key so shared devices keep each
 * user's choice across logout/login; fall back to the legacy single key.
 */
export function getStoredStoreId(username?: string | null): string | null {
  if (typeof window === "undefined") return null;
  if (username?.trim()) {
    return (
      localStorage.getItem(keyForUsername(username)) ??
      localStorage.getItem(LEGACY_STORE_KEY)
    );
  }
  return localStorage.getItem(LEGACY_STORE_KEY);
}

export function setStoredStoreId(
  storeId: string,
  username?: string | null,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEGACY_STORE_KEY, storeId);
  if (username?.trim()) {
    localStorage.setItem(keyForUsername(username), storeId);
  }
  window.dispatchEvent(new Event("magazin:store-changed"));
}

export function clearStoredStoreId(username?: string | null): void {
  if (typeof window === "undefined") return;
  let removed = false;
  if (username?.trim()) {
    const key = keyForUsername(username);
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      removed = true;
    }
  }
  if (localStorage.getItem(LEGACY_STORE_KEY)) {
    localStorage.removeItem(LEGACY_STORE_KEY);
    removed = true;
  }
  if (removed) {
    window.dispatchEvent(new Event("magazin:store-changed"));
  }
}
