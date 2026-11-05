/** Soft white hub glyphs matched to the option-8 mockup (rounded SF-style). */

import type { ReactNode } from "react";

type IconProps = { className?: string };

/** Default hub stroke — thinner than the old 2.15 mockup weight. */
const base = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.55,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Finer inner details (chip lines, dense glyphs). */
const finer = {
  ...base,
  strokeWidth: 1.35,
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

/** График — calendar */
export function HubScheduleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="3.4" y="5.2" width="17.2" height="15.2" rx="2.2" {...base} />
      <path d="M3.4 10.2h17.2" {...base} />
      <path d="M8 3.4v3.6M16 3.4v3.6" {...base} />
      <path d="M7.6 14.1h2.2M11 14.1h2.2M14.4 14.1h2.2" {...base} />
      <path d="M7.6 17.1h2.2M11 17.1h2.2" {...base} />
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

/** Плащания — credit card (outline + stripe + chip/digits) */
export function HubBillingIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2.2" {...base} />
      {/* Magnetic stripe */}
      <path d="M2 10h20" {...base} />
      {/* Small chip under the stripe */}
      <rect x="5" y="12.35" width="3.2" height="2.4" rx="0.45" {...finer} />
      {/* Number stubs */}
      <path d="M10.2 13.55h7.6" {...finer} />
      <path d="M10.2 15.55h4.8" {...finer} />
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

/** Анализ — rising chart */
export function HubAnalyticsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3.6 19.2V4.8" {...base} />
      <path d="M3.6 19.2h16.8" {...base} />
      <path d="m6.6 13.8 3.5-3.6 2.7 2.6 5-5.6" {...base} />
      <path d="M15.4 7.2h3.4v3.4" {...base} />
    </Glyph>
  );
}

/** Дневник — notebook */
export function HubJournalIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path
        d="M6.2 3.4h11.6A1.8 1.8 0 0 1 19.6 5.2v13.6a1.8 1.8 0 0 1-1.8 1.8H6.2A1.8 1.8 0 0 1 4.4 18.8V5.2A1.8 1.8 0 0 1 6.2 3.4Z"
        {...base}
      />
      <path d="M8.4 3.4v17.2" {...base} />
      <path d="M11.2 8.2h5.2M11.2 12h5.2M11.2 15.8h3.4" {...base} />
    </Glyph>
  );
}

/** Чеклисти */
export function HubChecklistsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9.2 6.6h10" {...base} />
      <path d="M9.2 12h10" {...base} />
      <path d="M9.2 17.4h10" {...base} />
      <path d="m3.8 6.6 1.35 1.35 2.5-2.7" {...base} />
      <path d="m3.8 12 1.35 1.35 2.5-2.7" {...base} />
      <path d="m3.8 17.4 1.35 1.35 2.5-2.7" {...base} />
    </Glyph>
  );
}

/** Температурен дневник — full snowflake left, thermometer right */
export function HubTemperatureIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      {/* Full snowflake (left) — finer so dense arms don’t blot */}
      <path d="M6.6 4.6v9.2" {...finer} />
      <path d="M2 9.2h9.2" {...finer} />
      <path d="m3.4 6 6.4 6.4" {...finer} />
      <path d="m9.8 6-6.4 6.4" {...finer} />
      <path d="M6.6 4.6 5.55 5.8M6.6 4.6 7.65 5.8" {...finer} />
      <path d="M6.6 13.8 5.55 12.6M6.6 13.8 7.65 12.6" {...finer} />
      <path d="M2 9.2 3.2 8.15M2 9.2 3.2 10.25" {...finer} />
      <path d="M11.2 9.2 10 8.15M11.2 9.2 10 10.25" {...finer} />

      {/* Thermometer (right) */}
      <path
        d="M14.2 14.2V4.5a2.4 2.4 0 0 1 4.8 0v9.7a3.6 3.6 0 1 1-4.8 0Z"
        {...base}
      />
      <path d="M16.6 15.2V6.3" {...base} />
      <circle cx="16.6" cy="17.2" r="1.45" fill="currentColor" stroke="none" />
      <path d="M19.8 6.5h1.7M19.8 8.7h1.7M19.8 10.9h1.7M19.8 13.1h1.7" {...base} />
    </Glyph>
  );
}
