"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nProvider } from "@/components/i18n-provider";
import {
  getClientLocale,
  setClientLocale,
  type MobileLocale,
} from "@/lib/client-locale";
import { syncPushLocale } from "@/lib/sync-push-locale";

type MobileLocaleContextValue = {
  locale: MobileLocale;
  setLocale: (locale: MobileLocale) => void;
};

const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null);

export function MobileI18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start with the SSR default so the first client paint matches HTML.
  const [locale, setLocaleState] = useState<MobileLocale>("en");
  const [localeReady, setLocaleReady] = useState(false);

  useEffect(() => {
    const stored = getClientLocale();
    setLocaleState(stored);
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    document.documentElement.lang = locale;
  }, [locale, localeReady]);

  const setLocale = useCallback((next: MobileLocale) => {
    setClientLocale(next);
    setLocaleState(next);
    syncPushLocale(next);
  }, []);

  return (
    <MobileLocaleContext.Provider value={{ locale, setLocale }}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </MobileLocaleContext.Provider>
  );
}

export function useMobileLocale() {
  const context = useContext(MobileLocaleContext);
  if (!context) {
    throw new Error("useMobileLocale must be used within MobileI18nProvider");
  }
  return context;
}
