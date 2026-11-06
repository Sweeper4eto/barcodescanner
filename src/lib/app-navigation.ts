type SoftNavigate = (path: string) => void;

let softPush: SoftNavigate | null = null;
let softReplace: SoftNavigate | null = null;

/** Wired from AppShell so in-app links can soft-navigate without a full reload. */
export function registerAppSoftNavigate(handlers: {
  push: SoftNavigate;
  replace: SoftNavigate;
} | null) {
  softPush = handlers?.push ?? null;
  softReplace = handlers?.replace ?? null;
}

export function navigateApp(path: string) {
  if (softPush) {
    softPush(path);
    return;
  }
  window.location.assign(path);
}

/** Prefer for post-submit flows so Back does not return to the finished form. */
export function replaceApp(path: string) {
  if (softReplace) {
    softReplace(path);
    return;
  }
  window.location.replace(path);
}

/**
 * Update the address bar for same-path query changes without a Next.js
 * soft-navigation (avoids remounting /app screens when switching stores).
 */
export function replaceAppUrlQuiet(path: string) {
  if (typeof window === "undefined") return;
  const next = new URL(path, window.location.origin);
  const current = new URL(window.location.href);
  if (
    next.pathname === current.pathname &&
    next.search === current.search &&
    next.hash === current.hash
  ) {
    return;
  }
  window.history.replaceState(window.history.state, "", `${next.pathname}${next.search}${next.hash}`);
}

export function goBackOrApp(fallback = "/app") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateApp(fallback);
}

/**
 * Hub icon flow entry screens. Back from these always returns to the home hub
 * (not browser history). Nested screens inside a flow still use goBackOrApp.
 */
export const HUB_FLOW_ROOT_PATHS = [
  "/app/expiry", // Годност → starts at expiry list
  "/app/team", // Екип
  "/app/settings/notifications", // Известия
  "/app/contact", // Поддръжка
] as const;

/**
 * Subflows under Годност — leave always to expiry list (never home / random history).
 * Includes barcode scan, add-product, and document OCR.
 */
export const EXPIRY_SUBFLOW_PATHS = [
  "/app/scan",
  "/app/add-product",
  "/app/add-document",
] as const;

/** @deprecated use EXPIRY_SUBFLOW_PATHS */
export const SCAN_SUBFLOW_PATHS = EXPIRY_SUBFLOW_PATHS;

export function normalizeAppPathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isHubFlowRootPath(pathname: string): boolean {
  return (HUB_FLOW_ROOT_PATHS as readonly string[]).includes(
    normalizeAppPathname(pathname),
  );
}

export function isExpirySubflowPath(pathname: string): boolean {
  return (EXPIRY_SUBFLOW_PATHS as readonly string[]).includes(
    normalizeAppPathname(pathname),
  );
}

/** @deprecated use isExpirySubflowPath */
export function isScanSubflowPath(pathname: string): boolean {
  return isExpirySubflowPath(pathname);
}

export function expiryListHref(storeId?: string | null): string {
  return storeId
    ? `/app/expiry?storeId=${encodeURIComponent(storeId)}`
    : "/app/expiry";
}

/** Exit scan / add-product subflow → expiry list. */
export function exitToExpiryList(storeId?: string | null) {
  replaceApp(expiryListHref(storeId));
}

/**
 * Header ← :
 * - hub flow root (expiry list) → home hub
 * - scan subflow → expiry list (caller should prefer onBack for wizard steps)
 * - else history (fallback /app)
 */
export function goHeaderBack(pathname: string, storeId?: string | null) {
  if (isHubFlowRootPath(pathname)) {
    replaceApp("/app");
    return;
  }
  if (isExpirySubflowPath(pathname)) {
    exitToExpiryList(storeId);
    return;
  }
  goBackOrApp("/app");
}

/**
 * Bottom tabs visibility.
 * - Classic UI: always show (Expiry / Add / Cart are the main entry points).
 * - New UI (hub): only inside the expiry work flow (list / scan / cart / document);
 *   home hub replaces tabs elsewhere. Document is part of Expiry, not a home tile.
 */
export function shouldShowAppBottomNav(
  pathname: string,
  options?: { newUiEnabled?: boolean },
): boolean {
  if (!options?.newUiEnabled) return true;
  return (
    pathname.startsWith("/app/expiry") ||
    pathname.startsWith("/app/scan") ||
    pathname.startsWith("/app/add-product") ||
    pathname.startsWith("/app/orders") ||
    pathname.startsWith("/app/buy-list") ||
    pathname.startsWith("/app/add-document")
  );
}
