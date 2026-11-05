/** Soft white hub glyphs matched to the option-8 mockup (rounded SF-style). */

import type { ReactNode } from "react";

type IconProps = { className?: string };

const base = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2.15,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyph({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className ? `home-hub-glyph ${className}` : "home-hub-glyph"}
    >
      {children}
    </svg>
  );
}

/** Годност — soft clock ring + hands */
export function HubExpiryIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="12" r="8.35" {...base} />
      <path d="M12 7.35v5.05l3.55 2.05" {...base} />
    </Glyph>
  );
}

/** График — rising chart */
export function HubScheduleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3.6 19.2V4.8" {...base} />
      <path d="M3.6 19.2h16.8" {...base} />
      <path d="m6.6 13.8 3.5-3.6 2.7 2.6 5-5.6" {...base} />
      <path d="M15.4 7.2h3.4v3.4" {...base} />
    </Glyph>
  );
}

/** Екип — filled soft silhouettes */
export function HubTeamIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="9" cy="7.5" r="3.15" fill="currentColor" stroke="none" />
      <circle cx="17" cy="8.6" r="2.45" fill="currentColor" stroke="none" />
      <path
        d="M3.1 19.4c.15-3.55 2.7-5.85 5.9-5.85s5.75 2.3 5.9 5.85"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M13.6 19.4c.4-2.4 2.15-4.05 4.45-4.2 2 .2 3.4 1.6 3.75 4.2"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}

/** Плащания — soft card */
export function HubBillingIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.6" {...base} />
      <path d="M2.8 10h18.4" {...base} strokeWidth={2.4} />
      <path d="M6.6 15.1h4.4" {...base} />
    </Glyph>
  );
}

/** Поддръжка — Lucide wrench (unmistakable) */
export function HubSupportIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        {...base}
      />
    </Glyph>
  );
}

/** Списък */
export function HubListIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="5.2" cy="6.8" r="1.45" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="12" r="1.45" fill="currentColor" stroke="none" />
      <circle cx="5.2" cy="17.2" r="1.45" fill="currentColor" stroke="none" />
      <path d="M9.2 6.8h10" {...base} />
      <path d="M9.2 12h10" {...base} />
      <path d="M9.2 17.2h7.4" {...base} />
    </Glyph>
  );
}

/** Известия */
export function HubBellIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        d="M12 3.4c.65 0 1.15.45 1.25 1.05A5.9 5.9 0 0 1 18 10.1c0 2.2.5 3.65 1.05 4.6.28.48-.05 1.1-.62 1.1H5.57c-.57 0-.9-.62-.62-1.1.55-.95 1.05-2.4 1.05-4.6a5.9 5.9 0 0 1 4.75-5.65C10.85 3.85 11.35 3.4 12 3.4Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M9.55 17.9a2.55 2.55 0 0 0 4.9 0" {...base} />
    </Glyph>
  );
}

/** Документ */
export function HubDocumentIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        d="M13.8 3.2H7.6A1.9 1.9 0 0 0 5.7 5.1v13.8a1.9 1.9 0 0 0 1.9 1.9h8.8a1.9 1.9 0 0 0 1.9-1.9V8.3L13.8 3.2Z"
        {...base}
      />
      <path d="M13.8 3.2V8.3h5.1" {...base} />
      <path d="M9.1 12.6h5.9" {...base} />
      <path d="M9.1 16h4.2" {...base} />
    </Glyph>
  );
}
