"use client";

import { useMobileLocale } from "@/components/mobile-i18n-provider";
import type { MobileLocale } from "@/lib/client-locale";

const options: { value: MobileLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "bg", label: "BG" },
];

export function LanguageSwitch() {
  const { locale, setLocale } = useMobileLocale();

  return (
    <div
      className="inline-flex rounded-lg border border-input-border bg-card p-0.5 text-sm"
      role="group"
      aria-label="Language"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
            locale === option.value
              ? "bg-primary text-primary-fg"
              : "text-muted hover:text-foreground"
          }`}
          aria-pressed={locale === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
