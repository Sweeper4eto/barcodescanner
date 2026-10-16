"use client";

/**
 * Active store id for /app screens. Backed by StoreSelectionProvider so the
 * header picker and every page share one value (no stale URL snap-back).
 */
export {
  useAppStoreId,
  useSetAppStoreId,
} from "@/components/store-selection-provider";
