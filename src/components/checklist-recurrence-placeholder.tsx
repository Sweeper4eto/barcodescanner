import type { ComponentPropsWithoutRef } from "react";
import type { ChecklistRecurrence } from "@/lib/checklist";

type Props = ComponentPropsWithoutRef<"div"> & {
  recurrence: ChecklistRecurrence | string;
  /** Short period label drawn inside the tile under the calendar/clock. */
  caption?: string;
  /** Icon + caption color (defaults to accent mint). */
  toneClassName?: string;
};

function CalendarBadge({
  label,
  className = "h-full w-full",
}: {
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden
    >
      <rect
        x="12"
        y="14"
        width="40"
        height="38"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.25"
      />
      <path
        d="M12 26h40"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.45"
      />
      <path
        d="M22 10v8M42 10v8"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fill="currentColor"
        fontSize={label.length > 1 ? "16" : "18"}
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

function ClockBadge({ className = "h-full w-full" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      aria-hidden
    >
      <circle
        cx="32"
        cy="34"
        r="18"
        stroke="currentColor"
        strokeWidth="2.25"
      />
      <path
        d="M32 22v12l8 5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 12h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function artForRecurrence(recurrence: string) {
  if (recurrence === "daily") return <CalendarBadge label="1" />;
  if (recurrence === "weekly") return <CalendarBadge label="7" />;
  if (recurrence === "monthly") return <CalendarBadge label="31" />;
  // once / custom hour-style date
  return <ClockBadge />;
}

/**
 * Checklist “no picture” tile in the same mint-glow language as
 * {@link NoPicturePlaceholder}, with period cue: 1 / 7 / 31 / clock.
 * Optional `caption` sits inside the box under the art (Дневен / Седмичен / …).
 */
export function ChecklistRecurrencePlaceholder({
  recurrence,
  caption,
  toneClassName = "text-accent",
  className = "",
  ...props
}: Props) {
  const captionText = caption?.trim() ?? "";
  const hasCaption = Boolean(captionText);
  // Scale type by longest word so "Седмичен" stays one full line (no ellipsis).
  const captionLen = captionText.length;
  const captionClass =
    captionLen > 8
      ? "text-[7px] tracking-tighter"
      : captionLen > 6
        ? "text-[8px] tracking-tight"
        : "text-[9px] tracking-tight";

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden border border-current/30 bg-zinc-950 ${toneClassName} ${
        hasCaption ? "gap-0.5 px-0.5 pb-1 pt-1" : ""
      } ${className}`}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.22),transparent_68%)]"
        aria-hidden
      />
      <div
        className={`relative flex min-h-0 shrink items-center justify-center ${
          hasCaption ? "h-[64%] w-[80%]" : "h-[82%] w-[82%]"
        }`}
      >
        {artForRecurrence(recurrence)}
      </div>
      {hasCaption ? (
        <span
          className={`relative z-[1] max-w-full whitespace-nowrap text-center font-semibold leading-none ${captionClass}`}
          title={captionText}
        >
          {captionText}
        </span>
      ) : null}
    </div>
  );
}
