"use client";

import { useEffect } from "react";

function isEditableField(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    // Skip non-text controls that don't open the soft keyboard.
    return ![
      "button",
      "checkbox",
      "radio",
      "file",
      "submit",
      "reset",
      "image",
      "range",
      "color",
      "hidden",
    ].includes(type);
  }
  return el.isContentEditable;
}

/**
 * Keeps the focused text field in view when the mobile soft keyboard opens
 * (especially iOS Safari, where fixed/full-height layouts don't always resize).
 */
export function KeepKeyboardFocusVisible() {
  useEffect(() => {
    let timer: number | undefined;

    function scrollActiveIntoView() {
      const el = document.activeElement;
      if (!isEditableField(el)) return;

      window.requestAnimationFrame(() => {
        if (document.activeElement !== el) return;
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      });
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(scrollActiveIntoView, 90);
    }

    function onFocusIn(event: FocusEvent) {
      if (isEditableField(event.target)) schedule();
    }

    document.addEventListener("focusin", onFocusIn, true);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);

    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
