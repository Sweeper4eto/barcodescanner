/** Bottom-nav re-tap of the active tab — restart that flow from scratch. */

export const TAB_RESELECT_EVENT = "expire365-tab-reselect";

export type AppNavTabId = "expiry" | "add" | "document" | "orders";

export function requestTabReselect(tabId: AppNavTabId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TAB_RESELECT_EVENT, { detail: { tabId } }),
  );
}

export function isTabReselectEvent(
  event: Event,
  tabId: AppNavTabId,
): boolean {
  return (
    event instanceof CustomEvent &&
    (event.detail as { tabId?: string } | undefined)?.tabId === tabId
  );
}
