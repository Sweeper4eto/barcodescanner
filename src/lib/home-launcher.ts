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
  "analytics",
  "journal",
  "checklists",
  "temperature",
] as const;

export type HomeModuleId = (typeof HOME_MODULE_IDS)[number];

/** Placeholder tiles — visible but not openable yet. */
export const HOME_LOCKED_MODULE_IDS = [
  "analytics",
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
  modules.push("analytics", "journal", "checklists", "temperature");
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

/**
 * Active modules fill from slot 0 (page 1 first). Locked “Soon” tiles start
 * on page 2 so newly enabled features never open on page 2 while page 1
 * still has room.
 */
export function defaultHomeLauncherLayout(
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  const slots = emptyLauncherSlots();
  const { active, locked } = splitActiveAndLocked(
    availableHomeModules(availability),
  );
  active.forEach((id, index) => {
    if (index < slots.length) slots[index] = id;
  });
  let lockedAt = HOME_LAUNCHER_SLOTS_PER_PAGE;
  for (const id of locked) {
    if (lockedAt < slots.length) {
      slots[lockedAt] = id;
      lockedAt += 1;
      continue;
    }
    const free = firstFreeSlot(slots, 0);
    if (free < 0) break;
    slots[free] = id;
  }
  return { slots };
}

/**
 * Keep saved positions for active modules; put new active modules in the
 * earliest free slots (page 1 first). Locked tiles prefer page 2+ and yield
 * page 1 when something newly enabled needs a slot.
 */
export function reconcileHomeLauncherLayout(
  saved: HomeLauncherLayout | null,
  availability: HomeLauncherAvailability,
): HomeLauncherLayout {
  const { active, locked } = splitActiveAndLocked(
    availableHomeModules(availability),
  );
  const activeSet = new Set(active);
  const lockedSet = new Set(locked);
  const slots = emptyLauncherSlots();
  const placed = new Set<HomeModuleId>();

  if (saved?.slots?.length) {
    const limit = Math.min(saved.slots.length, slots.length);
    for (let i = 0; i < limit; i += 1) {
      const id = saved.slots[i];
      if (!id || !activeSet.has(id) || placed.has(id)) continue;
      slots[i] = id;
      placed.add(id);
    }
  }

  for (const id of active) {
    if (placed.has(id)) continue;
    const free = firstFreeSlot(slots, 0);
    if (free < 0) break;
    slots[free] = id;
    placed.add(id);
  }

  if (saved?.slots?.length) {
    for (
      let i = HOME_LAUNCHER_SLOTS_PER_PAGE;
      i < Math.min(saved.slots.length, slots.length);
      i += 1
    ) {
      const id = saved.slots[i];
      if (!id || !lockedSet.has(id) || placed.has(id)) continue;
      if (slots[i] != null) continue;
      slots[i] = id;
      placed.add(id);
    }
  }

  for (const id of locked) {
    if (placed.has(id)) continue;
    let free = firstFreeSlot(slots, HOME_LAUNCHER_SLOTS_PER_PAGE);
    if (free < 0) free = firstFreeSlot(slots, 0);
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
