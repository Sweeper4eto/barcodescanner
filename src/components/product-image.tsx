"use client";

import { useRef, useState, type MouseEvent } from "react";
import { useT } from "@/components/i18n-provider";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  onLongPress?: () => void;
};

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
  const showImage = Boolean(src?.trim()) && !broken;

  function clearPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function startPress() {
    if (!onLongPress) return;
    clearPress();
    pressTimer.current = setTimeout(() => {
      onLongPress();
    }, 450);
  }

  function onContextMenu(event: MouseEvent) {
    if (!onLongPress) return;
    event.preventDefault();
    onLongPress();
  }

  if (!showImage) {
    return (
      <div
        className={`flex items-center justify-center bg-subtle text-center text-muted ${placeholderClassName || className}`}
        role="img"
        aria-label={t("common.noPicture")}
        onTouchStart={onLongPress ? startPress : undefined}
        onTouchEnd={onLongPress ? clearPress : undefined}
        onTouchCancel={onLongPress ? clearPress : undefined}
        onMouseDown={onLongPress ? startPress : undefined}
        onMouseUp={onLongPress ? clearPress : undefined}
        onMouseLeave={onLongPress ? clearPress : undefined}
        onContextMenu={onLongPress ? onContextMenu : undefined}
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
      className={className}
      onError={() => setBroken(true)}
      draggable={false}
      onTouchStart={onLongPress ? startPress : undefined}
      onTouchEnd={onLongPress ? clearPress : undefined}
      onTouchCancel={onLongPress ? clearPress : undefined}
      onMouseDown={onLongPress ? startPress : undefined}
      onMouseUp={onLongPress ? clearPress : undefined}
      onMouseLeave={onLongPress ? clearPress : undefined}
      onContextMenu={onLongPress ? onContextMenu : undefined}
    />
  );
}