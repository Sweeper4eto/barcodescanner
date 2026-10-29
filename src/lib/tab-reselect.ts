/** Bottom-nav re-tap of the active tab — restart that flow from scratch. */

export const TAB_RESELECT_EVENT = "expire365-tab-reselect";

export type AppNavTabId = "expiry" | "add" | "document" | "orders";

/**
 * Whether re-tapping this tab should show “Start over?” first.
 * Default true. Document scan sets false on the live camera / location step —
 * only photo preview and retake need a confirm (camera dialogs cover those).
 */
const tabReselectNeedsConfirm = new Map<AppNavTabId, boolean>();

export function setTabReselectNeedsConfirm(
  tabId: AppNavTabId,
  needsConfirm: boolean,
): void {
  tabReselectNeedsConfirm.set(tabId, needsConfirm);
}

export function getTabReselectNeedsConfirm(tabId: AppNavTabId): boolean {
  return tabReselectNeedsConfirm.get(tabId) ?? true;
}

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
