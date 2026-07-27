"use client";

import { useMobileLocale } from "@/components/mobile-i18n-provider";
import type { MobileLocale } from "@/lib/client-locale";

const options: { value: MobileLocale; label: string; flag: string }[] = [
  { value: "en", label: "EN", flag: "🇬🇧" },
  { value: "bg", label: "БГ", flag: "🇧🇬" },
];

export function LanguageSwitch() {
  const { locale, setLocale } = useMobileLocale();
  const selected = options.find((option) => option.value === locale) ?? options[0];

  return (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor="language-select">
        Language
      </label>
      <select
        id="language-select"
        className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
        value={locale}
        onChange={(event) => setLocale(event.target.value as MobileLocale)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div
        aria-hidden
        className="pointer-events-none flex items-center gap-1 rounded-lg border border-input-border bg-card px-2 py-1.5 pr-1 text-xs text-foreground"
      >
        <span aria-hidden>{selected.flag}</span>
        <span>{selected.label}</span>
        <span className="shrink-0 text-[0.6rem] text-muted">▼</span>
      </div>
    </div>
  );
}
