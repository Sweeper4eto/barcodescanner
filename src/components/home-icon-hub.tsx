"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { navigateApp } from "@/lib/app-navigation";
import {
  HubAnalyticsIcon,
  HubBellIcon,
  HubBillingIcon,
  HubChecklistsIcon,
  HubExpiryIcon,
  HubJournalIcon,
  HubScheduleIcon,
  HubSupportIcon,
  HubTeamIcon,
  HubTemperatureIcon,
} from "@/components/home-hub-icons";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/i18n";
import {
  HOME_LAUNCHER_MAX_PAGES,
  HOME_LAUNCHER_SLOTS_PER_PAGE,
  isHomeModuleLocked,
  type HomeLauncherAvailability,
  type HomeLauncherLayout,
  type HomeModuleId,
  mergeHiddenOptionalSlots,
  moveHomeLauncherIcon,
  occupiedHomeLauncherPages,
  pageIndexForSlot,
  readHomeLauncherLayout,
  reconcileHomeLauncherLayout,
  slotOnPage,
  writeHomeLauncherLayout,
} from "@/lib/home-launcher";

const LONG_PRESS_MS = 400;
/** Nearly-still: only then block scroll so Safari long-press can fire. */
const HOLD_LOCK_PX = 10;
/** Cancel long-press for non-swipe movement beyond this. */
const LONG_PRESS_SLOP_PX = 24;
/** Start page-swipe from a tile as soon as horizontal intent is clear (Android). */
const PAGE_SWIPE_START_PX = 12;
const PAGE_SWIPE_PX = 48;
const PAGE_SWIPE_RATIO = 0.22;
const PAGE_SWIPE_DOMINANCE = 1.15;
const PAGE_EDGE_PX = 44;
const PAGE_FLIP_HOLD_MS = 480;
const PAGE_SNAP_MS = 320;

type ModuleDef = {
  id: HomeModuleId;
  labelKey: MessageKey;
  href: (storeQuery: string) => string;
  icon: ReactNode;
  locked?: boolean;
};

function moduleDefs(storeQuery: string): Record<HomeModuleId, ModuleDef> {
  return {
    expiry: {
      id: "expiry",
      labelKey: "app.hubExpiry",
      href: () => `/app/expiry${storeQuery}`,
      icon: <HubExpiryIcon />,
    },
    schedule: {
      id: "schedule",
      labelKey: "app.hubSchedule",
      href: () => `/app/schedule`,
      icon: <HubScheduleIcon />,
    },
    team: {
      id: "team",
      labelKey: "app.hubTeam",
      href: () => `/app/team`,
      icon: <HubTeamIcon />,
    },
    billing: {
      id: "billing",
      labelKey: "app.hubBilling",
      href: () => `/app/billing`,
      icon: <HubBillingIcon />,
    },
    contact: {
      id: "contact",
      labelKey: "app.hubSupport",
      href: () => `/app/contact`,
      icon: <HubSupportIcon />,
    },
    notifications: {
      id: "notifications",
      labelKey: "app.hubNotifications",
      href: () => `/app/settings/notifications`,
      icon: <HubBellIcon />,
    },
    analytics: {
      id: "analytics",
      labelKey: "app.hubAnalytics",
      href: () => "/app/analytics",
      icon: <HubAnalyticsIcon />,
    },
    journal: {
      id: "journal",
      labelKey: "app.hubJournal",
      href: () => "/app",
      icon: <HubJournalIcon />,
      locked: true,
    },
    checklists: {
      id: "checklists",
      labelKey: "app.hubChecklists",
      href: () => `/app/checklists${storeQuery}`,
      icon: <HubChecklistsIcon />,
    },
    temperature: {
      id: "temperature",
      labelKey: "app.hubTemperature",
      href: () => "/app",
      icon: <HubTemperatureIcon />,
      locked: true,
    },
  };
}

type HomeIconHubProps = {
  username: string;
  storeId: string;
  availability: HomeLauncherAvailability;
  disabled?: boolean;
};

type PressSession = {
  slot: number;
  moduleId: HomeModuleId;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  dragging: boolean;
  /** Button that started the press — capture only after long-press drag. */
  target: HTMLButtonElement | null;
};

export function HomeIconHub({
  username,
  storeId,
  availability,
  disabled = false,
}: HomeIconHubProps) {
  const { t } = useT();
  const storeQuery = storeId ? `?storeId=${encodeURIComponent(storeId)}` : "";
  const defs = moduleDefs(storeQuery);

  const [layout, setLayout] = useState<HomeLauncherLayout>(() =>
    reconcileHomeLauncherLayout(
      readHomeLauncherLayout(username),
      availability,
    ),
  );
  const [checklistDueCount, setChecklistDueCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rearranging, setRearranging] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [floatModule, setFloatModule] = useState<HomeModuleId | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [, setStagingPage] = useState(false);
  /** Synced immediately — React state alone is too late for edge-flip → empty page 3. */
  const stagingPageRef = useRef(false);

  const pressRef = useRef<PressSession | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageFlipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageFlipDir = useRef<-1 | 1 | 0>(0);
  const suppressClick = useRef(false);
  const pageSwipe = useRef<{
    x: number;
    y: number;
    active: boolean;
    locked: boolean;
  } | null>(null);
  const slotRefs = useRef<Array<HTMLElement | null>>([]);
  const floatElRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const floatSizeRef = useRef(96);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef(layout);
  const pageRef = useRef(page);
  const rearrangingRef = useRef(false);
  /** Safari often drops element-level pointermove/up — keep a window fallback. */
  const windowPointerUnbind = useRef<(() => void) | null>(null);
  /** Skip lostpointercapture when we intentionally release capture. */
  const ignoreLostCapture = useRef(false);
  layoutRef.current = layout;
  pageRef.current = page;
  rearrangingRef.current = rearranging;

  function viewportWidth() {
    return viewportRef.current?.clientWidth || window.innerWidth || 1;
  }

  function setTrackOffset(px: number, animate: boolean) {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animate
      ? `transform ${PAGE_SNAP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none";
    track.style.transform = `translate3d(${px}px, 0, 0)`;
  }

  function occupiedPages() {
    return occupiedHomeLauncherPages(layoutRef.current);
  }

  function visiblePages() {
    const occupied = occupiedPages();
    if (stagingPageRef.current && occupied < HOME_LAUNCHER_MAX_PAGES) {
      return occupied + 1;
    }
    return occupied;
  }

  function setStaging(on: boolean) {
    stagingPageRef.current = on;
    setStagingPage(on);
  }

  function pageOffset(pageIndex: number) {
    return -pageIndex * viewportWidth();
  }

  function goToPage(next: number, animate = true) {
    const max = Math.max(0, visiblePages() - 1);
    const clamped = Math.max(0, Math.min(max, next));
    pageRef.current = clamped;
    setPage(clamped);
    setTrackOffset(pageOffset(clamped), animate);
  }

  function placeFloat(x: number, y: number) {
    const el = floatElRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }

  function showFloat(x: number, y: number, size: number) {
    const el = floatElRef.current;
    if (!el) return;
    floatSizeRef.current = size;
    el.style.width = `${size}px`;
    el.style.visibility = "visible";
    el.style.opacity = "0.72";
    placeFloat(x, y);
  }

  function hideFloat() {
    const el = floatElRef.current;
    if (!el) return;
    el.style.visibility = "hidden";
    el.style.opacity = "0";
  }

  function clearPressTimer() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  /** Immediate hold cue — CSS paints even when React commits are deferred until touchend (Safari / remote iOS). */
  function setTileHolding(target: HTMLElement | null, on: boolean) {
    if (!target) return;
    target.classList.toggle("home-hub-tile-holding", on);
  }

  function setRootRearranging(on: boolean) {
    rootRef.current?.classList.toggle("is-rearranging", on);
  }

  function clearPageFlipTimer() {
    if (pageFlipTimer.current) {
      clearTimeout(pageFlipTimer.current);
      pageFlipTimer.current = null;
    }
    pageFlipDir.current = 0;
  }

  function persist(next: HomeLauncherLayout) {
    layoutRef.current = next;
    setLayout(next);
    // Immediate write — only user rearrange (and first-time seed) touch storage.
    const previous = readHomeLauncherLayout(username);
    writeHomeLauncherLayout(
      username,
      mergeHiddenOptionalSlots(next, previous, availability),
    );
  }

  function slotFromPoint(clientX: number, clientY: number): number | null {
    const currentPage = pageRef.current;
    for (let i = 0; i < HOME_LAUNCHER_SLOTS_PER_PAGE; i += 1) {
      const absolute = slotOnPage(currentPage, i);
      const el = slotRefs.current[absolute];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return absolute;
      }
    }
    return null;
  }

  function maybeFlipPageAtEdge(clientX: number) {
    // Use hub viewport edges — window width misses centered / padded layouts.
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const right = rect?.right ?? (typeof window !== "undefined" ? window.innerWidth : 0);
    const occupied = occupiedPages();
    let dir: -1 | 1 | 0 = 0;
    if (clientX <= left + PAGE_EDGE_PX && pageRef.current > 0) dir = -1;
    else if (clientX >= right - PAGE_EDGE_PX) {
      // Allow one empty staging page beyond occupied (up to MAX).
      const maxReach =
        occupied < HOME_LAUNCHER_MAX_PAGES ? occupied : occupied - 1;
      if (pageRef.current < maxReach) dir = 1;
    }

    if (dir === 0) {
      clearPageFlipTimer();
      return;
    }
    if (pageFlipDir.current === dir && pageFlipTimer.current) return;

    clearPageFlipTimer();
    pageFlipDir.current = dir;
    pageFlipTimer.current = setTimeout(() => {
      pageFlipTimer.current = null;
      const next = pageRef.current + dir;
      if (next < 0) return;
      if (next >= occupied && occupied < HOME_LAUNCHER_MAX_PAGES) {
        // Must paint the empty page before goToPage — otherwise clamp stays on page 2.
        flushSync(() => {
          setStaging(true);
        });
        goToPage(next, true);
        setDragOverSlot(null);
      } else if (next < occupied) {
        goToPage(next, true);
        setDragOverSlot(null);
      }
      pageFlipDir.current = 0;
    }, PAGE_FLIP_HOLD_MS);
  }

  function unbindWindowPointer() {
    windowPointerUnbind.current?.();
    windowPointerUnbind.current = null;
  }

  function bindWindowPointer(pointerId: number) {
    unbindWindowPointer();
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      drivePointerMove(event.clientX, event.clientY, event);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      drivePointerUp(event.clientX, event.clientY);
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      drivePointerCancel(event.clientX, event.clientY);
    };
    const onLost = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (ignoreLostCapture.current) return;
      // Safari: capture can be lost mid-drag with no further tile events.
      if (pressRef.current?.dragging) {
        drivePointerUp(
          lastPointerRef.current.x,
          lastPointerRef.current.y,
        );
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("lostpointercapture", onLost, true);
    windowPointerUnbind.current = () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("lostpointercapture", onLost, true);
    };
  }

  function releaseTileCapture(session: PressSession | null) {
    if (!session?.target) return;
    ignoreLostCapture.current = true;
    try {
      session.target.releasePointerCapture(session.pointerId);
    } catch {
      /* may not have been captured */
    }
    // Allow the lostpointercapture event to flush before re-arming.
    queueMicrotask(() => {
      ignoreLostCapture.current = false;
    });
  }

  function beginDrag(session: PressSession, x: number, y: number) {
    pageSwipe.current = null;
    session.dragging = true;
    rearrangingRef.current = true;
    setTileHolding(session.target, false);
    // Paint rearrange chrome before React — iOS often defers setState paint until finger-up.
    setRootRearranging(true);
    // Mouse/pen only — touch capture fights Android swipe and is flaky on Safari.
    if (session.pointerType !== "touch" && session.target) {
      try {
        session.target.setPointerCapture(session.pointerId);
      } catch {
        /* ignore */
      }
    }
    try {
      navigator.vibrate?.(12);
    } catch {
      /* unsupported */
    }
    const tile = slotRefs.current[session.slot];
    const size = Math.max(72, (tile?.getBoundingClientRect().width ?? 96) * 1.3);
    lastPointerRef.current = { x, y };
    floatSizeRef.current = size;
    suppressClick.current = true;
    // flushSync: float content + placeholders must exist before showFloat (Safari touch).
    flushSync(() => {
      setRearranging(true);
      setDraggingSlot(session.slot);
      setFloatModule(session.moduleId);
      setDragOverSlot(session.slot);
    });
    showFloat(lastPointerRef.current.x, lastPointerRef.current.y, size);
  }

  function updatePageSwipe(clientX: number, clientY: number) {
    const swipe = pageSwipe.current;
    if (!swipe?.active || rearrangingRef.current) return;

    const dx = clientX - swipe.x;
    const dy = clientY - swipe.y;

    if (
      !swipe.locked &&
      Math.abs(dx) > 12 &&
      Math.abs(dx) > Math.abs(dy) * PAGE_SWIPE_DOMINANCE
    ) {
      swipe.locked = true;
      clearPressTimer();
    }
    if (!swipe.locked) return;

    const last = visiblePages() - 1;
    let offsetDx = dx;
    if (
      (pageRef.current === 0 && dx > 0) ||
      (pageRef.current === last && dx < 0)
    ) {
      offsetDx = dx * 0.35;
    }
    setTrackOffset(pageOffset(pageRef.current) + offsetDx, false);
  }

  function endPageSwipe(clientX: number, clientY: number) {
    const swipe = pageSwipe.current;
    pageSwipe.current = null;
    if (!swipe?.active || rearrangingRef.current) {
      setTrackOffset(pageOffset(pageRef.current), true);
      return;
    }

    const dx = clientX - swipe.x;
    const dy = clientY - swipe.y;
    const width = viewportWidth();
    const shouldFlip =
      swipe.locked &&
      Math.abs(dx) >= Math.min(PAGE_SWIPE_PX, width * PAGE_SWIPE_RATIO) &&
      Math.abs(dx) > Math.abs(dy) * PAGE_SWIPE_DOMINANCE;

    const last = visiblePages() - 1;
    let next = pageRef.current;
    if (shouldFlip) {
      if (dx < 0 && pageRef.current < last) next += 1;
      else if (dx > 0 && pageRef.current > 0) next -= 1;
    }

    // Any locked horizontal swipe (even if page didn’t flip) must not open a tile.
    if (swipe.locked || next !== pageRef.current) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 280);
    }
    goToPage(next, true);
  }

  /**
   * Horizontal flick on a tile → page swipe (iOS-home style).
   * Do not hand capture to the viewport — Safari often fails that transfer.
   * Window listeners keep driving the gesture.
   */
  function handoffTilePressToPageSwipe(
    session: PressSession,
    clientX: number,
    clientY: number,
  ) {
    clearPressTimer();
    setTileHolding(session.target, false);
    pressRef.current = null;
    releaseTileCapture(session);
    pageSwipe.current = {
      x: session.startX,
      y: session.startY,
      active: true,
      locked: true,
    };
    updatePageSwipe(clientX, clientY);
  }

  useEffect(() => {
    if (!floatModule) {
      hideFloat();
      return;
    }
    showFloat(
      lastPointerRef.current.x,
      lastPointerRef.current.y,
      floatSizeRef.current,
    );
  }, [floatModule]);

  function finishDrag(clientX: number, clientY: number) {
    const session = pressRef.current;
    pressRef.current = null;
    clearPressTimer();
    clearPageFlipTimer();
    unbindWindowPointer();
    setTileHolding(session?.target ?? null, false);
    hideFloat();
    setFloatModule(null);
    setDragOverSlot(null);
    setDraggingSlot(null);

    if (!session?.dragging) {
      rearrangingRef.current = false;
      setRootRearranging(false);
      setRearranging(false);
      setStaging(false);
      return;
    }

    const from = session.slot;
    const target = slotFromPoint(clientX, clientY);

    if (target != null && target !== from) {
      persist(moveHomeLauncherIcon(layoutRef.current, from, target));
      setStaging(false);
      goToPage(pageIndexForSlot(target), true);
    } else {
      setStaging(false);
      const occupied = occupiedHomeLauncherPages(layoutRef.current);
      if (pageRef.current >= occupied) goToPage(Math.max(0, occupied - 1), true);
    }

    rearrangingRef.current = false;
    setRootRearranging(false);
    setRearranging(false);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 250);
  }

  useEffect(() => {
    const saved = readHomeLauncherLayout(username);
    const next = reconcileHomeLauncherLayout(saved, availability);
    setLayout(next);
    // Seed defaults once. Never rewrite a saved arrangement on navigate/remount —
    // only persist() after the user moves an icon may change storage.
    if (!saved) {
      writeHomeLauncherLayout(username, next);
    }
  }, [
    username,
    availability.schedule,
    availability.team,
    availability.billing,
    availability.analytics,
    availability.checklists,
  ]);

  useEffect(() => {
    if (!availability.checklists || !storeId) {
      setChecklistDueCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/checklists/badge?storeId=${encodeURIComponent(storeId)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { dueTodayIncomplete?: number };
        if (!cancelled) {
          setChecklistDueCount(Math.max(0, Number(data.dueTodayIncomplete) || 0));
        }
      } catch {
        if (!cancelled) setChecklistDueCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [availability.checklists, storeId]);

  useEffect(() => {
    setPortalReady(true);
    setTrackOffset(pageOffset(pageRef.current), false);
    function onResize() {
      setTrackOffset(pageOffset(pageRef.current), false);
    }
    window.addEventListener("resize", onResize);

    /**
     * iOS Safari: document touchmove is passive by default. Non-passive listener
     * must exist before the gesture so preventDefault can stop scroll/cancel
     * during long-press hold and while rearranging (dnd-kit pattern).
     */
    const onTouchMove = (event: TouchEvent) => {
      const session = pressRef.current;
      const touch = event.touches[0];
      if (!touch) return;

      if (session?.dragging || rearrangingRef.current) {
        if (event.cancelable) event.preventDefault();
        drivePointerMove(touch.clientX, touch.clientY);
        return;
      }

      if (!session) {
        if (pageSwipe.current?.active) {
          if (event.cancelable) event.preventDefault();
          updatePageSwipe(touch.clientX, touch.clientY);
        }
        return;
      }

      const dx = touch.clientX - session.startX;
      const dy = touch.clientY - session.startY;
      const dist = Math.hypot(dx, dy);
      const horizontal =
        dist >= PAGE_SWIPE_START_PX &&
        Math.abs(dx) > Math.abs(dy) * PAGE_SWIPE_DOMINANCE;

      // Android: horizontal flick on an icon must page immediately — do not
      // eat the gesture with a wide preventDefault slop.
      if (horizontal) {
        drivePointerMove(touch.clientX, touch.clientY);
        if (event.cancelable) event.preventDefault();
        return;
      }

      // Safari hold: only lock scroll while the finger is almost still.
      if (dist <= HOLD_LOCK_PX) {
        if (event.cancelable) event.preventDefault();
        return;
      }

      drivePointerMove(touch.clientX, touch.clientY);
      if (pressRef.current?.dragging || pageSwipe.current?.active) {
        if (event.cancelable) event.preventDefault();
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const x = touch?.clientX ?? lastPointerRef.current.x;
      const y = touch?.clientY ?? lastPointerRef.current.y;
      if (pressRef.current || pageSwipe.current?.active) {
        drivePointerUp(x, y);
      }
    };

    const onTouchCancel = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      const x = touch?.clientX ?? lastPointerRef.current.x;
      const y = touch?.clientY ?? lastPointerRef.current.y;
      if (pressRef.current || pageSwipe.current?.active) {
        drivePointerCancel(x, y);
      }
    };

    // touchforcechange also participates in iOS scroll takeover.
    const preventForceScroll = (event: Event) => {
      if (pressRef.current || rearrangingRef.current) {
        if ("cancelable" in event && event.cancelable) {
          event.preventDefault();
        }
      }
    };

    document.addEventListener("touchmove", onTouchMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", onTouchEnd, { capture: true });
    document.addEventListener("touchcancel", onTouchCancel, { capture: true });
    document.addEventListener("touchforcechange", preventForceScroll, {
      passive: false,
      capture: true,
    });

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("touchcancel", onTouchCancel, true);
      document.removeEventListener("touchforcechange", preventForceScroll, true);
      clearPressTimer();
      clearPageFlipTimer();
      unbindWindowPointer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drivePointerMove(
    clientX: number,
    clientY: number,
    event?: PointerEvent | ReactPointerEvent<Element>,
  ) {
    // After horizontal handoff, keep paging even if press was cleared.
    if (!pressRef.current && pageSwipe.current?.active) {
      updatePageSwipe(clientX, clientY);
      return;
    }

    const session = pressRef.current;
    if (!session) return;

    if (!session.dragging) {
      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const dist = Math.hypot(dx, dy);
      // Ignore tiny wobble so Safari long-press can still fire.
      if (dist <= HOLD_LOCK_PX) return;

      // Horizontal flick on a tile → page swipe (must win over long-press).
      if (
        dist >= PAGE_SWIPE_START_PX &&
        Math.abs(dx) > Math.abs(dy) * PAGE_SWIPE_DOMINANCE
      ) {
        clearPressTimer();
        handoffTilePressToPageSwipe(session, clientX, clientY);
        return;
      }

      // Bigger non-swipe move → abandon long-press (allow native feel).
      if (dist > LONG_PRESS_SLOP_PX) {
        clearPressTimer();
        setTileHolding(session.target, false);
      }
      return;
    }

    event?.preventDefault();
    lastPointerRef.current = { x: clientX, y: clientY };
    placeFloat(clientX, clientY);
    maybeFlipPageAtEdge(clientX);
    setDragOverSlot(slotFromPoint(clientX, clientY));
  }

  function drivePointerUp(clientX: number, clientY: number) {
    if (pageSwipe.current?.active && !pressRef.current?.dragging) {
      setTileHolding(pressRef.current?.target ?? null, false);
      releaseTileCapture(pressRef.current);
      unbindWindowPointer();
      endPageSwipe(clientX, clientY);
      return;
    }

    const session = pressRef.current;
    if (!session) {
      unbindWindowPointer();
      return;
    }

    releaseTileCapture(session);

    if (session.dragging) {
      finishDrag(clientX, clientY);
      return;
    }

    clearPressTimer();
    setTileHolding(session.target, false);
    pressRef.current = null;
    unbindWindowPointer();
  }

  function drivePointerCancel(clientX: number, clientY: number) {
    if (pageSwipe.current?.active && !pressRef.current?.dragging) {
      setTileHolding(pressRef.current?.target ?? null, false);
      unbindWindowPointer();
      endPageSwipe(clientX, clientY);
      return;
    }
    const session = pressRef.current;
    if (!session) {
      unbindWindowPointer();
      return;
    }
    // Safari ends the gesture with cancel — must drop, not ignore.
    if (session.dragging) {
      finishDrag(clientX, clientY);
      return;
    }
    clearPressTimer();
    setTileHolding(session.target, false);
    pressRef.current = null;
    unbindWindowPointer();
  }

  function onTilePointerDown(
    slot: number,
    moduleId: HomeModuleId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (disabled) return;
    if (event.button != null && event.button !== 0) return;

    // Capture only for mouse/pen. On touch, capture fights Android page-swipe
    // that starts on an icon — window/document listeners drive the gesture.
    if (event.pointerType !== "touch") {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }

    pageSwipe.current = null;
    clearPressTimer();
    setTileHolding(event.currentTarget, true);
    pressRef.current = {
      slot,
      moduleId,
      pointerId: event.pointerId,
      pointerType: event.pointerType || "mouse",
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      target: event.currentTarget,
    };
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    bindWindowPointer(event.pointerId);

    longPressTimer.current = setTimeout(() => {
      const session = pressRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      beginDrag(session, lastPointerRef.current.x, lastPointerRef.current.y);
    }, LONG_PRESS_MS);
  }

  function onTilePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = pressRef.current;
    if (session && session.pointerId !== event.pointerId) return;
    if (!session && !pageSwipe.current?.active) return;
    drivePointerMove(event.clientX, event.clientY, event);
  }

  function onTilePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = pressRef.current;
    if (session && session.pointerId !== event.pointerId) return;
    drivePointerUp(event.clientX, event.clientY);
  }

  function onTilePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = pressRef.current;
    if (session && session.pointerId !== event.pointerId) return;
    drivePointerCancel(event.clientX, event.clientY);
  }

  function onHubPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (rearrangingRef.current || pressRef.current || disabled) return;
    if (event.button != null && event.button !== 0) return;
    pageSwipe.current = {
      x: event.clientX,
      y: event.clientY,
      active: true,
      locked: false,
    };
  }

  function onHubPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pageSwipe.current?.active || rearrangingRef.current) return;
    if (pressRef.current?.dragging) return;
    updatePageSwipe(event.clientX, event.clientY);
  }

  function onHubPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (pressRef.current?.dragging) {
      pageSwipe.current = null;
      setTrackOffset(pageOffset(pageRef.current), true);
      return;
    }
    endPageSwipe(event.clientX, event.clientY);
  }

  const pageCount = visiblePages();
  const floatDef = floatModule ? defs[floatModule] : null;

  function tileContent(def: ModuleDef) {
    return (
      <>
        {def.icon}
        <span className="home-hub-label">{t(def.labelKey)}</span>
        {def.locked ? (
          <span className="home-hub-soon">{t("app.hubComingSoon")}</span>
        ) : null}
      </>
    );
  }

  function renderPage(pageIndex: number) {
    return (
      <div
        key={pageIndex}
        className="home-hub-page"
        role="list"
        aria-label={t("app.hubPage", { page: pageIndex + 1 })}
      >
        <div className="home-hub-grid">
          {Array.from({ length: HOME_LAUNCHER_SLOTS_PER_PAGE }, (_, index) => {
            const absolute = slotOnPage(pageIndex, index);
            const moduleId = layout.slots[absolute];
            const isDraggingHere = draggingSlot === absolute;
            const isDropTarget =
              rearranging &&
              pageIndex === page &&
              dragOverSlot === absolute &&
              !isDraggingHere;

            return (
              <div
                key={absolute}
                ref={(el) => {
                  slotRefs.current[absolute] = el;
                }}
                className="relative"
                role="listitem"
              >
                {moduleId == null ? (
                  rearranging ? (
                    <div
                      className={`home-hub-placeholder${
                        isDropTarget ? " home-hub-drop-target" : ""
                      }`}
                      aria-hidden
                    />
                  ) : (
                    <div className="aspect-square w-full" aria-hidden />
                  )
                ) : (
                  (() => {
                    const def = defs[moduleId];
                    const locked = Boolean(def.locked) || isHomeModuleLocked(moduleId);
                    const attention =
                      moduleId === "checklists" &&
                      checklistDueCount > 0 &&
                      !locked &&
                      !rearranging;
                    const tileClass = `home-hub-tile${
                      isDropTarget ? " home-hub-drop-target-tile" : ""
                    }${disabled || locked ? " home-hub-tile-locked" : ""}${
                      attention ? " home-hub-tile-attention" : ""
                    }${disabled ? " pointer-events-none" : ""}${
                      rearranging || locked
                        ? ""
                        : " transition-transform active:scale-[0.97]"
                    }`;

                    return (
                      <>
                        {isDraggingHere ? (
                          <div
                            className="home-hub-slot-shadow absolute inset-0"
                            aria-hidden
                          />
                        ) : null}
                        <button
                          type="button"
                          className={tileClass}
                          aria-disabled={locked || undefined}
                          aria-label={
                            attention
                              ? t("checklists.hubDueAria", {
                                  count: checklistDueCount,
                                })
                              : undefined
                          }
                          title={
                            locked
                              ? t("app.hubComingSoon")
                              : attention
                                ? t("checklists.hubDueAria", {
                                    count: checklistDueCount,
                                  })
                                : undefined
                          }
                          onPointerDown={(e) =>
                            onTilePointerDown(absolute, moduleId, e)
                          }
                          onPointerMove={onTilePointerMove}
                          onPointerUp={onTilePointerUp}
                          onPointerCancel={onTilePointerCancel}
                          onClick={() => {
                            if (
                              disabled ||
                              locked ||
                              suppressClick.current ||
                              rearrangingRef.current ||
                              pressRef.current?.dragging
                            ) {
                              return;
                            }
                            navigateApp(def.href(storeQuery));
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                          style={{
                            opacity: isDraggingHere ? 0 : undefined,
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {tileContent(def)}
                        </button>
                      </>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`home-hub-root select-none${
        rearranging ? " is-rearranging" : ""
      }`}
    >
      <div
        ref={viewportRef}
        className="home-hub-viewport"
        aria-label={t("app.hubLabel")}
        onPointerDown={onHubPointerDown}
        onPointerMove={onHubPointerMove}
        onPointerUp={onHubPointerEnd}
        onPointerCancel={() => {
          if (pressRef.current?.dragging) {
            drivePointerCancel(
              lastPointerRef.current.x,
              lastPointerRef.current.y,
            );
            return;
          }
          pageSwipe.current = null;
          unbindWindowPointer();
          setTrackOffset(pageOffset(pageRef.current), true);
        }}
      >
        <div ref={trackRef} className="home-hub-track">
          {Array.from({ length: pageCount }, (_, i) => renderPage(i))}
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-2.5">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("app.hubPage", { page: i + 1 })}
              aria-current={page === i ? "true" : undefined}
              className={`h-2 w-2 rounded-full transition-colors ${
                page === i
                  ? "bg-primary shadow-[0_0_10px_rgba(52,211,153,0.65)]"
                  : "bg-zinc-600"
              }`}
              onClick={() => goToPage(i, true)}
            />
          ))}
        </div>
      ) : null}

      {rearranging ? (
        <p className="mt-3 text-center text-xs text-muted">
          {t("app.hubRearrangeHint")}
        </p>
      ) : null}

      {portalReady
        ? createPortal(
            <div
              ref={floatElRef}
              aria-hidden
              className="home-hub-tile home-hub-tile-float"
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: floatSizeRef.current,
                maxWidth: "min(10rem, 34vw)",
                zIndex: 9999,
                pointerEvents: "none",
                visibility: "hidden",
                opacity: 0,
                willChange: "transform",
              }}
            >
              {floatDef ? tileContent(floatDef) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
