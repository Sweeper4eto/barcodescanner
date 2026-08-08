"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /** Hold ~0.5s or double-tap to change the picture. */
  onLongPress?: () => void;
};

const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 350;

export function ProductImage({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  onLongPress,
}: Props) {
  const { t } = useT();
  const [broken, setBroken] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const longPressFiredRef = useRef(false);
  const showImage = Boolean(src?.trim()) && !broken;

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function clearTextSelection() {
    const selection = window.getSelection?.();
    selection?.removeAllRanges();
  }

  function triggerChange() {
    if (!onLongPress) return;
    clearTextSelection();
    onLongPress();
    // iOS sometimes applies the selection after the overlay mounts.
    window.setTimeout(clearTextSelection, 0);
    window.setTimeout(clearTextSelection, 50);
  }

  function startPress(event: PointerEvent) {
    if (!onLongPress) return;
    // Stop the browser from selecting nearby text while holding.
    event.preventDefault();
    clearPress();
    longPressFiredRef.current = false;
    pressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      lastTapRef.current = 0;
      triggerChange();
    }, LONG_PRESS_MS);
  }

  function onPointerUp(event: PointerEvent) {
    if (!onLongPress) return;
    // Ignore secondary buttons / multi-touch leftovers.
    if (event.pointerType === "mouse" && event.button !== 0) {
      clearPress();
      return;
    }
    clearPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      triggerChange();
      return;
    }
    lastTapRef.current = now;
  }

  function onContextMenu(event: MouseEvent) {
    if (!onLongPress) return;
    event.preventDefault();
    clearPress();
    triggerChange();
  }

  const interactiveProps = onLongPress
    ? {
        onPointerDown: startPress,
        onPointerUp,
        onPointerCancel: clearPress,
        onPointerLeave: clearPress,
        onContextMenu,
        style: {
          touchAction: "manipulation" as const,
          WebkitTouchCallout: "none" as const,
          WebkitUserSelect: "none" as const,
          userSelect: "none" as const,
        },
      }
    : {};

  if (!showImage) {
    return (
      <div
        className={`flex select-none items-center justify-center border border-card-border bg-transparent text-center text-muted ${placeholderClassName || className}`}
        role="img"
        aria-label={t("common.noPicture")}
        {...interactiveProps}
      >
        <span className="px-2 text-xs font-medium leading-tight">
          {t("common.noPicture")}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt={alt}
      className={`select-none ${className}`.trim()}
      onError={() => setBroken(true)}
      draggable={false}
      {...interactiveProps}
    />
  );
}
