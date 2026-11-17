import type { ReactNode } from "react";
import { PLACEHOLDER_ART_SIZE_CLASS } from "@/components/no-picture-placeholder";
import type { ChecklistRecurrence } from "@/lib/checklist";

type SvgProps = { className?: string; label?: string };

function Frame({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden border border-primary/30 bg-zinc-950 ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.22),transparent_68%)]"
        aria-hidden
      />
      <div
        className={`relative flex ${PLACEHOLDER_ART_SIZE_CLASS} items-center justify-center text-accent`}
      >
        {children}
      </div>
    </div>
  );
}

function Svg({ className, children }: SvgProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className ?? "h-full w-full"}
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** A — Calendar sheet with number (current shipping look). */
function ArtCalendarNumber({ label, className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="12" y="14" width="40" height="38" rx="6" stroke="currentColor" strokeWidth="2.25" />
      <path d="M12 26h40" stroke="currentColor" strokeWidth="2" opacity="0.45" />
      <path d="M22 10v8M42 10v8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label && label.length > 1 ? 16 : 18}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
    </Svg>
  );
}

function ArtClock({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="34" r="18" stroke="currentColor" strokeWidth="2.25" />
      <path
        d="M32 22v12l8 5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M26 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </Svg>
  );
}

/** B — Bold number in a circle (clock for once). */
function ArtCircleNumber({ label, className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2.25" />
      <text
        x="32"
        y="39"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label && label.length > 1 ? 18 : 22}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
    </Svg>
  );
}

/** C — Number only, no calendar chrome. */
function ArtPlainNumber({ label, className }: SvgProps) {
  return (
    <Svg className={className}>
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label && label.length > 1 ? 22 : 28}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
    </Svg>
  );
}

/** D — Rounded tile stamp with small caption under the number. */
function ArtStamp({
  label,
  caption,
  className,
}: SvgProps & { caption: string }) {
  return (
    <Svg className={className}>
      <rect x="10" y="10" width="44" height="44" rx="10" stroke="currentColor" strokeWidth="2.25" />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label && label.length > 1 ? 16 : 20}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
      <text
        x="32"
        y="48"
        textAnchor="middle"
        fill="currentColor"
        fontSize="7"
        fontWeight="600"
        fontFamily="system-ui,Segoe UI,sans-serif"
        opacity="0.7"
      >
        {caption}
      </text>
    </Svg>
  );
}

/** E — Soft filled mint disc. */
function ArtFilledDisc({ label, className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="32" r="20" fill="currentColor" opacity="0.18" />
      <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2" />
      <text
        x="32"
        y="39"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label && label.length > 1 ? 17 : 21}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
    </Svg>
  );
}

/** F — Dots / grid metaphor (1 dot, 7 dots week, 31 as mini grid). */
function ArtPeriodGlyph({
  recurrence,
  className,
}: {
  recurrence: ChecklistRecurrence;
  className?: string;
}) {
  if (recurrence === "daily") {
    return (
      <Svg className={className}>
        <circle cx="32" cy="28" r="10" stroke="currentColor" strokeWidth="2.25" />
        <text
          x="32"
          y="50"
          textAnchor="middle"
          fill="currentColor"
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,Segoe UI,sans-serif"
        >
          1
        </text>
      </Svg>
    );
  }
  if (recurrence === "weekly") {
    const dots = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const x = 14 + i * 6;
      return <circle key={i} cx={x} cy="30" r="2.2" fill="currentColor" />;
    });
    return (
      <Svg className={className}>
        {dots}
        <text
          x="32"
          y="50"
          textAnchor="middle"
          fill="currentColor"
          fontSize="11"
          fontWeight="700"
          fontFamily="system-ui,Segoe UI,sans-serif"
        >
          7
        </text>
      </Svg>
    );
  }
  if (recurrence === "monthly") {
    const cells = [];
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const n = r * 7 + c + 1;
        if (n > 31) continue;
        cells.push(
          <rect
            key={n}
            x={12 + c * 6}
            y={12 + r * 8}
            width="4.5"
            height="5.5"
            rx="0.8"
            fill="currentColor"
            opacity={n === 31 ? 1 : 0.35}
          />,
        );
      }
    }
    return (
      <Svg className={className}>
        {cells}
        <text
          x="32"
          y="54"
          textAnchor="middle"
          fill="currentColor"
          fontSize="10"
          fontWeight="700"
          fontFamily="system-ui,Segoe UI,sans-serif"
        >
          31
        </text>
      </Svg>
    );
  }
  return <ArtClock className={className} />;
}

export type ChecklistIconPreviewId =
  | "calendar"
  | "circle"
  | "plain"
  | "stamp"
  | "disc"
  | "glyph";

export const CHECKLIST_ICON_PREVIEW_OPTIONS: Array<{
  id: ChecklistIconPreviewId;
  title: string;
  description: string;
}> = [
  {
    id: "calendar",
    title: "A. Calendar + number",
    description: "Current look — calendar sheet with 1 / 7 / 31, clock for one-off.",
  },
  {
    id: "circle",
    title: "B. Circle number",
    description: "Big digit in a ring — cleaner at tiny thumbnail sizes.",
  },
  {
    id: "plain",
    title: "C. Number only",
    description: "Just the digit on the mint tile — maximum readability.",
  },
  {
    id: "stamp",
    title: "D. Stamp + caption",
    description: "Number with a tiny DAY / WEEK / MONTH label under it.",
  },
  {
    id: "disc",
    title: "E. Soft mint disc",
    description: "Filled accent disc — slightly softer, still outline border.",
  },
  {
    id: "glyph",
    title: "F. Period glyph",
    description: "1 sun-dot, 7 weekday dots, 31 mini-calendar grid, clock for one-off.",
  },
];

function artFor(
  style: ChecklistIconPreviewId,
  recurrence: ChecklistRecurrence,
): ReactNode {
  const label =
    recurrence === "daily"
      ? "1"
      : recurrence === "weekly"
        ? "7"
        : recurrence === "monthly"
          ? "31"
          : null;
  const caption =
    recurrence === "daily"
      ? "DAY"
      : recurrence === "weekly"
        ? "WEEK"
        : recurrence === "monthly"
          ? "MONTH"
          : "ONCE";

  if (recurrence === "once") {
    if (style === "stamp") {
      return (
        <Svg>
          <rect
            x="10"
            y="10"
            width="44"
            height="44"
            rx="10"
            stroke="currentColor"
            strokeWidth="2.25"
          />
          <g transform="translate(0,-2)">
            <circle cx="32" cy="30" r="11" stroke="currentColor" strokeWidth="2" />
            <path
              d="M32 23v7l5 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <text
            x="32"
            y="50"
            textAnchor="middle"
            fill="currentColor"
            fontSize="7"
            fontWeight="600"
            fontFamily="system-ui,Segoe UI,sans-serif"
            opacity="0.7"
          >
            ONCE
          </text>
        </Svg>
      );
    }
    return <ArtClock />;
  }

  switch (style) {
    case "calendar":
      return <ArtCalendarNumber label={label!} />;
    case "circle":
      return <ArtCircleNumber label={label!} />;
    case "plain":
      return <ArtPlainNumber label={label!} />;
    case "stamp":
      return <ArtStamp label={label!} caption={caption} />;
    case "disc":
      return <ArtFilledDisc label={label!} />;
    case "glyph":
      return <ArtPeriodGlyph recurrence={recurrence} />;
    default:
      return <ArtCalendarNumber label={label!} />;
  }
}

export function ChecklistIconPreviewTile({
  style,
  recurrence,
  className = "size-16 rounded-xl",
}: {
  style: ChecklistIconPreviewId;
  recurrence: ChecklistRecurrence;
  className?: string;
}) {
  return <Frame className={className}>{artFor(style, recurrence)}</Frame>;
}
