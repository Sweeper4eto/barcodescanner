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
