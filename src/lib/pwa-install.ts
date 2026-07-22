const DISMISS_KEY = "expire365-pwa-install-dismissed";
const OFFER_KEY = "expire365-offer-pwa";

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEventLike | null = null;

export function setDeferredInstallPrompt(
  event: BeforeInstallPromptEventLike | null,
): void {
  deferredPrompt = event;
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt(): void {
  deferredPrompt = null;
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const iOS = /iphone|ipad|ipod/.test(ua);
  const iPadOs =
    ua.includes("mac") && typeof document !== "undefined" && "ontouchend" in document;
  return iOS || iPadOs;
}

export function wasPwaInstallDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPwaInstallPrompt(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function markPwaInstallOffered(): void {
  try {
    window.sessionStorage.setItem(OFFER_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumePwaInstallOffer(): boolean {
  try {
    if (window.sessionStorage.getItem(OFFER_KEY) !== "1") return false;
    window.sessionStorage.removeItem(OFFER_KEY);
    return true;
  } catch {
    return false;
  }
}

export function shouldOfferPwaInstall(): boolean {
  return !isPwaInstalled() && !wasPwaInstallDismissed();
}