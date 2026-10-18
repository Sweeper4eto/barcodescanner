import type { Locale } from "@/i18n";

export type MobileLocale = Extract<Locale, "en" | "bg">;

export const CLIENT_LOCALE_KEY = "expire365-locale";
export const CLIENT_LOCALE_COOKIE = "expire365-locale";
const LEGACY_LOCALE_KEY = "magazin-locale";
/** Fired after setClientLocale so root UI (e.g. PWA install) stays in sync. */
export const CLIENT_LOCALE_CHANGED_EVENT = "expire365-locale-changed";

export const mobileLocales: MobileLocale[] = ["en", "bg"];

export function isMobileLocale(value: string | null): value is MobileLocale {
  return value === "en" || value === "bg";
}

export function getClientLocale(): MobileLocale {
  if (typeof window === "undefined") return "en";

  const stored =
    localStorage.getItem(CLIENT_LOCALE_KEY) ??
    localStorage.getItem(LEGACY_LOCALE_KEY);
  if (isMobileLocale(stored)) {
    if (localStorage.getItem(CLIENT_LOCALE_KEY) !== stored) {
      localStorage.setItem(CLIENT_LOCALE_KEY, stored);
    }
    localStorage.removeItem(LEGACY_LOCALE_KEY);
    return stored;
  }

  const browser = navigator.language.slice(0, 2).toLowerCase();
  return browser === "bg" ? "bg" : "en";
}

export function setClientLocale(locale: MobileLocale): void {
  localStorage.setItem(CLIENT_LOCALE_KEY, locale);
  localStorage.removeItem(LEGACY_LOCALE_KEY);
  document.cookie = `${CLIENT_LOCALE_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  document.cookie = `${LEGACY_LOCALE_KEY}=;path=/;max-age=0;SameSite=Lax`;
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event(CLIENT_LOCALE_CHANGED_EVENT));
}
