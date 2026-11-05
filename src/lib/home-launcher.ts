/** Home icon hub: fixed 9-slot pages, free absolute placement, local layout. */

export const HOME_LAUNCHER_SLOTS_PER_PAGE = 9;
export const HOME_LAUNCHER_MAX_PAGES = 3;
export const HOME_LAUNCHER_TOTAL_SLOTS =
  HOME_LAUNCHER_SLOTS_PER_PAGE * HOME_LAUNCHER_MAX_PAGES;

export const HOME_MODULE_IDS = [
  "expiry",
  "schedule",
  "team",
  "billing",
  "contact",
  "document",
  "notifications",
] as const;

export type HomeModuleId = (typeof HOME_MODULE_IDS)[number];

export type HomeLauncherAvailability = {
  schedule: boolean;
  team: boolean;
  billing: boolean;
  /** Business document scan */
  document: boolean;
};

export type HomeLauncherLayout = {
  /** Absolute slot index 0..TOTAL_SLOTS-1 → module id */
  slots: Array<HomeModuleId | null>;
};

const STORAGE_PREFIX = "expire365.homeLauncher.v1:";

export function isHomeModuleId(value: unknown): value is HomeModuleId {
  return (
    typeof value === "string" &&
    (HOME_MODULE_IDS as readonly string[]).includes(value)
  );
}

export function emptyLauncherSlots(): Array<HomeModuleId | null> {
  return Array.from({ length: HOME_LAUNCHER_TOTAL_SLOTS }, () => null);
}

/** Modules visible for this account / flags, in default fill order. */
export function availableHomeModules(
  availability: HomeLauncherAvailability,
): HomeModuleId[] {
  const modules: HomeModuleId[] = ["expiry"];
  if (availability.schedule) modules.push("schedule");
  if (availability.team) modules.push("team");
  if (availability.billing) modules.push("billing");
  modules.push("contact");
  if (availability.document) modules.push("document");
  modules.push("notifications");
  return modules;
}

export function defaultHomeLauncherLayout(
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  const slots = emptyLauncherSlots();
  const modules = availableHomeModules(availability);
  modules.forEach((id, index) => {
    if (index < slots.length) slots[index] = id;
  });
  return { slots };
}

/**
 * Keep saved positions for still-available modules; place new modules in
 * first free slots. Drop unavailable modules from the grid.
 */
export function reconcileHomeLauncherLayout(
  saved: HomeLauncherLayout | null,
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  const available = new Set(availableHomeModules(availability));
  const slots = emptyLauncherSlots();
  const placed = new Set<HomeModuleId>();

  if (saved?.slots?.length) {
    const limit = Math.min(saved.slots.length, slots.length);
    for (let i = 0; i < limit; i += 1) {
      const id = saved.slots[i];
      if (!id || !available.has(id) || placed.has(id)) continue;
      slots[i] = id;
      placed.add(id);
    }
  }

  for (const id of available) {
    if (placed.has(id)) continue;
    const free = slots.findIndex((slot) => slot == null);
    if (free < 0) break;
    slots[free] = id;
    placed.add(id);
  }

  return { slots };
}

export function moveHomeLauncherIcon(
  layout: HomeLauncherLayout,
  fromSlot: number,
  toSlot: number,
): HomeLauncherLayout {
  if (
    fromSlot === toSlot ||
    fromSlot < 0 ||
    toSlot < 0 ||
    fromSlot >= HOME_LAUNCHER_TOTAL_SLOTS ||
    toSlot >= HOME_LAUNCHER_TOTAL_SLOTS
  ) {
    return layout;
  }
  const slots = [...layout.slots];
  const moving = slots[fromSlot];
  if (moving == null) return layout;
  const target = slots[toSlot];
  slots[toSlot] = moving;
  slots[fromSlot] = target;
  return { slots };
}

export function homeLauncherStorageKey(username: string): string {
  return `${STORAGE_PREFIX}${username.trim().toLowerCase() || "anon"}`;
}

export function readHomeLauncherLayout(
  username: string,
): HomeLauncherLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(homeLauncherStorageKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slots?: unknown };
    if (!Array.isArray(parsed.slots)) return null;
    const slots = emptyLauncherSlots();
    for (let i = 0; i < Math.min(parsed.slots.length, slots.length); i += 1) {
      const value = parsed.slots[i];
      slots[i] = isHomeModuleId(value) ? value : null;
    }
    return { slots };
  } catch {
    return null;
  }
}

export function writeHomeLauncherLayout(
  username: string,
  layout: HomeLauncherLayout,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      homeLauncherStorageKey(username),
      JSON.stringify({ slots: layout.slots }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function pageIndexForSlot(slot: number): number {
  return Math.floor(slot / HOME_LAUNCHER_SLOTS_PER_PAGE);
}

export function slotOnPage(page: number, indexOnPage: number): number {
  return page * HOME_LAUNCHER_SLOTS_PER_PAGE + indexOnPage;
}

/** Pages that actually have icons (min 1). Extra empty pages are not counted. */
export function occupiedHomeLauncherPages(
  layout: HomeLauncherLayout,
): number {
  let maxSlot = -1;
  for (let i = 0; i < layout.slots.length; i += 1) {
    if (layout.slots[i] != null) maxSlot = i;
  }
  if (maxSlot < 0) return 1;
  return Math.min(
    HOME_LAUNCHER_MAX_PAGES,
    pageIndexForSlot(maxSlot) + 1,
  );
}
