"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/i18n-provider";
import { NoPicturePlaceholder } from "@/components/no-picture-placeholder";
import {
  applyPointerTap,
  emptyDoubleTapState,
  type DoubleTapState,
} from "@/lib/double-tap";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  /** Hold ~0.5s or double-tap to change the picture. */
  onLongPress?: () => void;
  /** Double-tap a real photo (not the no-picture art) to open it large. */
  zoomOnDoubleTap?: boolean;
};

const LONG_PRESS_MS = 450;

export function ProductImage({
  src,
  alt,
  className = "",
  placeholderClassName = "",
  onLongPress,
  zoomOnDoubleTap = false,
}: Props) {
  const { t } = useT();
  const [broken, setBroken] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapState = useRef<DoubleTapState>(emptyDoubleTapState());
  const longPressFiredRef = useRef(false);
  const showImage = Boolean(src?.trim()) && !broken;
  const canZoom = zoomOnDoubleTap && showImage;

  useEffect(() => {
    setBroken(false);
    setZoomed(false);
  }, [src]);

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
      tapState.current = emptyDoubleTapState();
      triggerChange();
    }, LONG_PRESS_MS);
  }

  /** True only for a second tap of the same kind. A phone tap also emits a fake mouse tap. */
  function isDoubleTap(event: PointerEvent): boolean {
    const result = applyPointerTap(
      tapState.current,
      { pointerType: event.pointerType, button: event.button },
      Date.now(),
    );
    tapState.current = result.state;
    return result.doubleTap;
  }

  function onPointerUp(event: PointerEvent) {
    if (!onLongPress) return;
    if (event.pointerType === "mouse" && event.button !== 0) {
      clearPress();
      return;
    }
    clearPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      tapState.current = emptyDoubleTapState();
      return;
    }
    if (!isDoubleTap(event)) return;
    if (canZoom) setZoomed(true);
    else triggerChange();
  }

  function onZoomPointerUp(event: PointerEvent) {
    if (!canZoom || onLongPress) return;
    if (isDoubleTap(event)) setZoomed(true);
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
    : canZoom
      ? {
          onPointerUp: onZoomPointerUp,
          role: "button" as const,
          tabIndex: 0,
          "aria-label": t("expiry.viewImage"),
          style: { touchAction: "manipulation" as const },
        }
      : {};

  if (!showImage) {
    return (
      <NoPicturePlaceholder
        className={`select-none ${placeholderClassName || className}`.trim()}
        role="img"
        aria-label={t("common.noPicture")}
        {...interactiveProps}
      />
    );
  }

  return (
    <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={src!}
      alt={alt}
      className={`select-none ${className}`.trim()}
      onError={() => setBroken(true)}
      draggable={false}
      {...interactiveProps}
    />
    {zoomed && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={t("expiry.viewImage")}
            onClick={() => setZoomed(false)}
          >
            <button
              type="button"
              className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] rounded-xl border border-card-border px-3 py-2.5 text-sm font-semibold text-foreground"
              onClick={() => setZoomed(false)}
            >
              {t("expiry.closeImage")}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src!}
              alt={alt}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>,
          document.body,
        )
      : null}
    </>
  );
}
