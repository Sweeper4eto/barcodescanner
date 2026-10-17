"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { sortLabelsPinnedFirst } from "@/lib/alpha-sort";

export type MenuSelectOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type MenuSelectProps<T extends string> = {
  value: T;
  options: MenuSelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  /** Shown when value is empty / not in options. */
  placeholder?: string;
  leadingIcon?: ReactNode;
  /** Compact header-style control (matches language switch). */
  size?: "field" | "compact";
  /** Align the menu to the start or end of the trigger. */
  menuAlign?: "start" | "end";
  /**
   * Sort options A–Z by label. Use `pinnedValues` to keep sentinels
   * (All / None / …) at the top.
   */
  sortByLabel?: boolean;
  pinnedValues?: readonly T[];
};

const TYPEAHEAD_RESET_MS = 800;

function normalizeTypeahead(value: string): string {
  return value.toLocaleLowerCase();
}

/** Prefix match; hidden multi-letter buffer (native &lt;select&gt;-style). */
function findTypeaheadMatch<T extends string>(
  list: MenuSelectOption<T>[],
  buffer: string,
): MenuSelectOption<T> | undefined {
  const needle = normalizeTypeahead(buffer);
  if (!needle) return undefined;
  return list.find(
    (option) =>
      !option.disabled &&
      normalizeTypeahead(option.label).startsWith(needle),
  );
}

export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
  buttonClassName = "",
  disabled = false,
  placeholder,
  leadingIcon,
  size = "field",
  menuAlign = "start",
  sortByLabel = false,
  pinnedValues = [],
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const typeBufferRef = useRef("");
  const typeTimerRef = useRef<number | null>(null);
  const listId = useId();
  const orderedOptions = useMemo(
    () =>
      sortByLabel
        ? sortLabelsPinnedFirst(options, pinnedValues)
        : options,
    [options, sortByLabel, pinnedValues],
  );
  const selected = orderedOptions.find((option) => option.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "";
  const compact = size === "compact";

  useEffect(() => {
    return () => {
      if (typeTimerRef.current != null) {
        window.clearTimeout(typeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function placeMenu() {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Prefer opening upward when the field is in the lower half of the screen.
      setMenuAbove(spaceBelow < 220 && spaceAbove > spaceBelow);
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    return () => window.removeEventListener("resize", placeMenu);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) setOpen(false);
    }

    function onDocKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  function scheduleTypeBufferReset() {
    if (typeTimerRef.current != null) {
      window.clearTimeout(typeTimerRef.current);
    }
    typeTimerRef.current = window.setTimeout(() => {
      typeBufferRef.current = "";
      typeTimerRef.current = null;
    }, TYPEAHEAD_RESET_MS);
  }

  function applyTypeahead(nextBuffer: string) {
    const match = findTypeaheadMatch(orderedOptions, nextBuffer);
    if (!match) return;
    onChange(match.value);
    const node = optionRefs.current.get(match.value);
    node?.scrollIntoView({ block: "nearest" });
  }

  function onTypeaheadKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (disabled) return;

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      const enabled = orderedOptions.filter((option) => !option.disabled);
      if (enabled.length === 0) return;
      const index = enabled.findIndex((option) => option.value === value);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next =
        enabled[
          index < 0
            ? 0
            : (index + delta + enabled.length) % enabled.length
        ];
      onChange(next.value);
      queueMicrotask(() => {
        optionRefs.current.get(next.value)?.scrollIntoView({ block: "nearest" });
      });
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      // Open: Enter/Space on an option is handled by the option button.
      if (event.key === "Enter") {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (event.key === "Backspace") {
      if (!typeBufferRef.current) return;
      event.preventDefault();
      typeBufferRef.current = typeBufferRef.current.slice(0, -1);
      scheduleTypeBufferReset();
      if (typeBufferRef.current) applyTypeahead(typeBufferRef.current);
      return;
    }

    // Printable character — accumulate hidden multi-letter buffer.
    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      typeBufferRef.current += event.key;
      scheduleTypeBufferReset();
      applyTypeahead(typeBufferRef.current);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${
        open ? "z-[90]" : compact ? "z-[40]" : "z-30"
      } ${className}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        className={
          buttonClassName ||
          (compact
            ? "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border border-input-border bg-transparent px-2 pr-1.5 text-left text-xs text-foreground disabled:opacity-50"
            : "mt-1 flex w-full min-w-0 items-center gap-2 rounded-xl border border-input-border bg-transparent py-2.5 pl-3 pr-3 text-left text-base text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 disabled:opacity-50")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onKeyDown={onTypeaheadKeyDown}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        {leadingIcon ? (
          <span
            aria-hidden
            className={`shrink-0 text-muted ${compact ? "[&_svg]:size-3.5" : "[&_svg]:size-4"}`}
          >
            {leadingIcon}
          </span>
        ) : null}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "text-foreground" : "text-muted"
          }`}
          title={displayLabel || undefined}
        >
          {displayLabel}
        </span>
        <span
          className={`shrink-0 text-muted transition-transform ${
            compact ? "text-[0.6rem]" : "text-[0.65rem]"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          className={`absolute z-[100] max-h-72 min-w-full w-max max-w-[min(90vw,24rem)] overflow-y-auto overscroll-contain rounded-xl border border-input-border py-1 shadow-lg shadow-black/50 outline-none ${
            menuAbove ? "bottom-full mb-1" : "top-full mt-1"
          } ${menuAlign === "end" ? "right-0" : "left-0"}`}
          style={{ backgroundColor: "var(--background)" }}
          onKeyDown={onTypeaheadKeyDown}
        >
          {orderedOptions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">{placeholder ?? label}</li>
          ) : (
            orderedOptions.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={option.disabled}
                    title={option.label}
                    ref={(node) => {
                      if (node) optionRefs.current.set(option.value, node);
                      else optionRefs.current.delete(option.value);
                    }}
                    className={`flex w-full px-3 py-2.5 text-left text-sm whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-selected text-primary"
                        : "text-foreground hover:bg-selected/40"
                    }`}
                    style={
                      active ? undefined : { backgroundColor: "var(--background)" }
                    }
                    onClick={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
