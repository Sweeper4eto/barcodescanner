const LEGACY_STORE_KEY = "magazin_selected_store";
const LEGACY_STORE_PREFIX = "magazin_selected_store:";
const STORE_KEY = "expire365_selected_store";
const STORE_KEY_PREFIX = "expire365_selected_store:";

export const STORE_CHANGED_EVENT = "expire365:store-changed";

function keyForUsername(username: string): string {
  return `${STORE_KEY_PREFIX}${username.trim().toLowerCase()}`;
}

function legacyKeyForUsername(username: string): string {
  return `${LEGACY_STORE_PREFIX}${username.trim().toLowerCase()}`;
}

function readMigrated(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key);
  if (current) return current;
  const legacy = localStorage.getItem(legacyKey);
  if (!legacy) return null;
  localStorage.setItem(key, legacy);
  localStorage.removeItem(legacyKey);
  return legacy;
}

/**
 * Last selected location. Prefer per-username key so shared devices keep each
 * user's choice across logout/login; fall back to the legacy single key.
 */
export function getStoredStoreId(username?: string | null): string | null {
  if (typeof window === "undefined") return null;
  if (username?.trim()) {
    return (
      readMigrated(keyForUsername(username), legacyKeyForUsername(username)) ??
      readMigrated(STORE_KEY, LEGACY_STORE_KEY)
    );
  }
  return readMigrated(STORE_KEY, LEGACY_STORE_KEY);
}

export function setStoredStoreId(
  storeId: string,
  username?: string | null,
): void {
  if (typeof window === "undefined") return;
  const before = getStoredStoreId(username);
  localStorage.setItem(STORE_KEY, storeId);
  localStorage.removeItem(LEGACY_STORE_KEY);
  if (username?.trim()) {
    localStorage.setItem(keyForUsername(username), storeId);
    localStorage.removeItem(legacyKeyForUsername(username));
  }
  // Skip event when nothing effective changed — avoids list reload flicker.
  if (before === storeId) return;
  window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

export function clearStoredStoreId(username?: string | null): void {
  if (typeof window === "undefined") return;
  let removed = false;
  const keys = [STORE_KEY, LEGACY_STORE_KEY];
  if (username?.trim()) {
    keys.push(keyForUsername(username), legacyKeyForUsername(username));
  }
  for (const key of keys) {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      removed = true;
    }
  }
  if (removed) {
    window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
  }
}
