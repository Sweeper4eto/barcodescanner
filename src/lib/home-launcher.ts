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
  "notifications",
  "analytics",
  "journal",
  "checklists",
  "temperature",
] as const;

export type HomeModuleId = (typeof HOME_MODULE_IDS)[number];

/** Placeholder tiles — visible but not openable yet. */
export const HOME_LOCKED_MODULE_IDS = [
  "journal",
  "checklists",
  "temperature",
] as const;

export function isHomeModuleLocked(id: HomeModuleId): boolean {
  return (HOME_LOCKED_MODULE_IDS as readonly string[]).includes(id);
}

export type HomeLauncherAvailability = {
  schedule: boolean;
  team: boolean;
  billing: boolean;
  /** Owner-only Statistics tile. */
  analytics: boolean;
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

/**
 * Default page-1 positions (1-based in product copy):
 * 1 Годност, 2 Екип, 3 Известия, 4–6 empty, 7 Поддръжка, 8 График, 9 Плащания.
 */
export const DEFAULT_HOME_SLOT_BY_MODULE: Partial<
  Record<HomeModuleId, number>
> = {
  expiry: 0,
  team: 1,
  notifications: 2,
  contact: 6,
  schedule: 7,
  billing: 8,
  /** Page 2 slot 1 — owner analytics. */
  analytics: HOME_LAUNCHER_SLOTS_PER_PAGE,
};

/**
 * Default page-2 positions for “Soon” tiles (1-based on that page):
 * 2 Дневник, 3 Чеклисти, 4 °C дневник (Анализ is active at slot 1).
 */
export const DEFAULT_LOCKED_SLOT_BY_MODULE: Partial<
  Record<HomeModuleId, number>
> = {
  journal: HOME_LAUNCHER_SLOTS_PER_PAGE + 1,
  checklists: HOME_LAUNCHER_SLOTS_PER_PAGE + 2,
  temperature: HOME_LAUNCHER_SLOTS_PER_PAGE + 3,
};

/** Modules visible for this account / flags. */
export function availableHomeModules(
  availability: HomeLauncherAvailability,
): HomeModuleId[] {
  const modules: HomeModuleId[] = ["expiry"];
  if (availability.schedule) modules.push("schedule");
  if (availability.team) modules.push("team");
  if (availability.billing) modules.push("billing");
  modules.push("contact");
  modules.push("notifications");
  if (availability.analytics) modules.push("analytics");
  modules.push("journal", "checklists", "temperature");
  return modules;
}

function firstFreeSlot(
  slots: Array<HomeModuleId | null>,
  from = 0,
): number {
  for (let i = from; i < slots.length; i += 1) {
    if (slots[i] == null) return i;
  }
  return -1;
}

function splitActiveAndLocked(modules: HomeModuleId[]): {
  active: HomeModuleId[];
  locked: HomeModuleId[];
} {
  const active: HomeModuleId[] = [];
  const locked: HomeModuleId[] = [];
  for (const id of modules) {
    if (isHomeModuleLocked(id)) locked.push(id);
    else active.push(id);
  }
  return { active, locked };
}

function placeModuleInPreferredOrFree(
  slots: Array<HomeModuleId | null>,
  id: HomeModuleId,
): boolean {
  const preferred = DEFAULT_HOME_SLOT_BY_MODULE[id];
  if (
    preferred != null &&
    preferred >= 0 &&
    preferred < slots.length &&
    slots[preferred] == null
  ) {
    slots[preferred] = id;
    return true;
  }
  // Preferred slot taken: fill next free without packing page-1 gaps first.
  let free = firstFreeSlot(slots, HOME_LAUNCHER_SLOTS_PER_PAGE);
  if (free < 0) free = firstFreeSlot(slots, 0);
  if (free < 0) return false;
  slots[free] = id;
  return true;
}

function placeLockedModule(
  slots: Array<HomeModuleId | null>,
  id: HomeModuleId,
): boolean {
  const preferred = DEFAULT_LOCKED_SLOT_BY_MODULE[id];
  if (
    preferred != null &&
    preferred >= 0 &&
    preferred < slots.length &&
    slots[preferred] == null
  ) {
    slots[preferred] = id;
    return true;
  }
  // Soon tiles stay on page 2+ only (never fill page-1 gaps).
  const free = firstFreeSlot(slots, HOME_LAUNCHER_SLOTS_PER_PAGE);
  if (free < 0) return false;
  slots[free] = id;
  return true;
}

/**
 * Initial hub layout before the user rearranges icons.
 */
export function defaultHomeLauncherLayout(
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  const slots = emptyLauncherSlots();
  const { active, locked } = splitActiveAndLocked(
    availableHomeModules(availability),
  );
  for (const id of locked) {
    placeLockedModule(slots, id);
  }
  for (const id of active) {
    placeModuleInPreferredOrFree(slots, id);
  }
  return { slots };
}

/** Optional tiles that may flicker off while home bootstraps (e.g. billing fetch). */
export const HOME_OPTIONAL_MODULE_IDS = [
  "schedule",
  "team",
  "billing",
] as const;

/**
 * Keep saved positions for active + locked modules (any page); place newly
 * enabled ones using preferred slots. Locked tiles without a saved slot land
 * on page 2+.
 */
export function reconcileHomeLauncherLayout(
  saved: HomeLauncherLayout | null,
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  if (!saved?.slots?.length) {
    return defaultHomeLauncherLayout(availability);
  }

  const { active, locked } = splitActiveAndLocked(
    availableHomeModules(availability),
  );
  const activeSet = new Set(active);
  const lockedSet = new Set(locked);
  const slots = emptyLauncherSlots();
  const placed = new Set<HomeModuleId>();

  const limit = Math.min(saved.slots.length, slots.length);
  for (let i = 0; i < limit; i += 1) {
    const id = saved.slots[i];
    if (!id || !activeSet.has(id) || placed.has(id)) continue;
    slots[i] = id;
    placed.add(id);
  }

  // Keep rearranged “Soon” tiles wherever the user put them (incl. page 1).
  for (let i = 0; i < limit; i += 1) {
    const id = saved.slots[i];
    if (!id || !lockedSet.has(id) || placed.has(id)) continue;
    if (slots[i] != null) continue;
    slots[i] = id;
    placed.add(id);
  }

  for (const id of active) {
    if (placed.has(id)) continue;
    if (!placeModuleInPreferredOrFree(slots, id)) break;
    placed.add(id);
  }

  for (const id of locked) {
    if (placed.has(id)) continue;
    if (!placeLockedModule(slots, id)) break;
    placed.add(id);
  }

  return { slots };
}

/**
 * When writing a layout that omits temporarily unavailable optionals (billing
 * still loading, schedule private, …), keep their previous slots in storage
 * so a later remount does not snap them back to defaults.
 */
export function mergeHiddenOptionalSlots(
  layout: HomeLauncherLayout,
  previous: HomeLauncherLayout | null,
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  if (!previous?.slots?.length) return layout;

  const available = new Set(availableHomeModules(availability));
  const slots = [...layout.slots];
  const used = new Set(
    slots.filter((id): id is HomeModuleId => id != null),
  );

  for (const id of HOME_OPTIONAL_MODULE_IDS) {
    if (available.has(id) || used.has(id)) continue;
    const prevIndex = previous.slots.indexOf(id);
    if (prevIndex < 0 || prevIndex >= slots.length) continue;
    if (slots[prevIndex] != null) continue;
    slots[prevIndex] = id;
    used.add(id);
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

/** Same-tab cache so remounts never briefly fall back to defaults. */
const layoutMemory = new Map<string, HomeLauncherLayout>();

function cloneLayout(layout: HomeLauncherLayout): HomeLauncherLayout {
  return { slots: [...layout.slots] };
}

export function homeLauncherLayoutsEqual(
  a: HomeLauncherLayout,
  b: HomeLauncherLayout,
): boolean {
  if (a.slots.length !== b.slots.length) return false;
  for (let i = 0; i < a.slots.length; i += 1) {
    if (a.slots[i] !== b.slots[i]) return false;
  }
  return true;
}

export function readHomeLauncherLayout(
  username: string,
): HomeLauncherLayout | null {
  const key = homeLauncherStorageKey(username);
  const cached = layoutMemory.get(key);
  if (cached) return cloneLayout(cached);
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slots?: unknown };
    if (!Array.isArray(parsed.slots)) return null;
    const slots = emptyLauncherSlots();
    for (let i = 0; i < Math.min(parsed.slots.length, slots.length); i += 1) {
      const value = parsed.slots[i];
      slots[i] = isHomeModuleId(value) ? value : null;
    }
    const layout = { slots };
    layoutMemory.set(key, cloneLayout(layout));
    return layout;
  } catch {
    return null;
  }
}

/**
 * Persist layout. Call only from user rearrange (or first-time seed).
 * Navigation / reconcile must not overwrite a saved arrangement.
 */
export function writeHomeLauncherLayout(
  username: string,
  layout: HomeLauncherLayout,
): void {
  const key = homeLauncherStorageKey(username);
  const next = cloneLayout(layout);
  layoutMemory.set(key, next);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ slots: next.slots }));
  } catch {
    /* ignore quota / private mode — memory cache still holds it this session */
  }
}

/** Test helper / logout cleanup. */
export function clearHomeLauncherLayoutCache(username?: string): void {
  if (username == null) {
    layoutMemory.clear();
    return;
  }
  layoutMemory.delete(homeLauncherStorageKey(username));
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
