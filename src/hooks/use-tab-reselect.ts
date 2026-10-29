"use client";

import { useEffect } from "react";
import {
  TAB_RESELECT_EVENT,
  isTabReselectEvent,
  type AppNavTabId,
} from "@/lib/tab-reselect";

/** Remount / reset when the user taps the already-active bottom-nav tab. */
export function useTabReselect(tabId: AppNavTabId, onReselect: () => void) {
  useEffect(() => {
    function onEvent(event: Event) {
      if (!isTabReselectEvent(event, tabId)) return;
      onReselect();
    }
    window.addEventListener(TAB_RESELECT_EVENT, onEvent);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, onEvent);
  }, [tabId, onReselect]);
}
