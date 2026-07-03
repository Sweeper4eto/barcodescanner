"use client";

import type { ReactNode } from "react";

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
    <div
      role="tablist"
      className="flex flex-wrap gap-1 border-b border-card-border"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`-mb-px rounded-t-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:py-2.5 sm:text-sm ${
              isActive
                ? "relative z-10 border border-b-0 border-card-border bg-card text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminPanel({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-card-border bg-card shadow-sm">
      {children}
    </div>
  );
}

export function AdminPanelBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-w-0 p-4 sm:p-5 md:p-6 ${className}`}>{children}</div>;
}

export function AdminSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
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
      <span className="mb-1.5 block font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const adminInputClass =
  "w-full min-w-0 rounded-xl border border-input-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export const adminSearchInputClass = `${adminInputClass} min-w-0 flex-1`;

export const adminButtonRowClass = "grid grid-cols-1 gap-2 sm:grid-cols-2";

export const adminDangerButtonClass =
  "w-full rounded-xl border border-danger-border px-4 py-3 text-base font-medium text-error disabled:opacity-50";

export const adminPaginationClass =
  "flex flex-wrap items-center justify-between gap-3 border-t border-card-border pt-4";

export function AdminEmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[10rem] items-center justify-center rounded-xl border border-dashed border-input-border bg-background px-6 py-8 text-center">
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
