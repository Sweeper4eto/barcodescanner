"use client";

import type { ReactNode } from "react";

const tabActive =
  "bg-primary text-primary-fg shadow-sm";
const tabInactive =
  "border border-input-border bg-card text-foreground hover:bg-subtle";

export function AdminTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-card-border bg-subtle p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            active === tab.id ? tabActive : tabInactive
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-card-border bg-card p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 border-b border-card-border pb-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function AdminField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const adminInputClass =
  "w-full rounded-xl border border-input-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary";

export function AdminEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-input-border bg-subtle/50 px-6 py-10 text-center">
      <p className="max-w-xs text-sm text-muted">{message}</p>
    </div>
  );
}
