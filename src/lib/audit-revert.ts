import { isAdhocBarcode } from "@/lib/inventory-entry-display";
import { deleteLocalProductIfUnused } from "@/lib/local-product";
import {
  activeInventoryWhere,
  expiryDateDayBounds,
  normalizeExpiryDate,
  priceReducedOffData,
  priceReducedOnData,
} from "@/lib/inventory";
import { activeBuyListWhere } from "@/lib/buy-list";
import { db } from "@/lib/db";
import type { AuditEvent } from "@/lib/audit-log";

export type AuditEntityType = "inventory_entry" | "buy_list_entry";

export type AuditRevertPayload = Record<string, unknown>;

export type AuditMutationMeta = {
  entityType: AuditEntityType;
  entityId: string;
  storeId?: string | null;
  payload: AuditRevertPayload;
  revertsAuditId?: string | null;
};

export type RevertBlockedReason =
  | "legacy"
  | "not_supported"
  | "already_reverted"
  | "hard_deleted"
  | "missing"
  | "conflict"
  | "purged";

export const REVERTIBLE_EVENTS: readonly AuditEvent[] = [
  "inventory_added",
  "inventory_merged",
  "inventory_removed",
  "inventory_updated",
  "inventory_price_reduced",
  "inventory_price_restored",
  "buy_list_added",
  "buy_list_merged",
  "buy_list_removed",
  "buy_list_updated",
] as const;

const REVERTIBLE_SET = new Set<string>(REVERTIBLE_EVENTS);

export function isRevertibleEvent(event: string): event is AuditEvent {
  return REVERTIBLE_SET.has(event);
}

export function parseAuditPayload(payloadJson: string | null | undefined): AuditRevertPayload | null {
  if (!payloadJson?.trim()) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as AuditRevertPayload;
  } catch {
    return null;
  }
}

export function serializeAuditPayload(payload: AuditRevertPayload): string {
  return JSON.stringify(payload);
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function sameExpiryDay(a: Date, iso: string): boolean {
  const bounds = expiryDateDayBounds(normalizeExpiryDate(new Date(iso)));
  return a >= bounds.start && a < bounds.end;
}

export function listRevertStatus(entry: {
  event: string;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  revertedAt: Date | null;
}): { revertible: boolean; revertBlockedReason?: RevertBlockedReason } {
  if (!isRevertibleEvent(entry.event)) {
    return { revertible: false, revertBlockedReason: "not_supported" };
  }
  if (entry.revertedAt) {
    return { revertible: false, revertBlockedReason: "already_reverted" };
  }
  if (!entry.entityType || !entry.entityId || !entry.payloadJson) {
    return { revertible: false, revertBlockedReason: "legacy" };
  }
  const payload = parseAuditPayload(entry.payloadJson);
  if (!payload) {
    return { revertible: false, revertBlockedReason: "legacy" };
  }
  if (
    (entry.event === "inventory_removed" || entry.event === "buy_list_removed") &&
    asBool(payload.soft) === false
  ) {
    return { revertible: false, revertBlockedReason: "hard_deleted" };
  }
  return { revertible: true };
}

export type RevertAuditRow = {
  id: string;
  userId: string;
  event: string;
  details: string;
  entityType: string | null;
  entityId: string | null;
  storeId: string | null;
  payloadJson: string | null;
  revertedAt: Date | null;
  occurredAt: Date;
  user: { clientId: string | null };
};

export class AuditRevertError extends Error {
  constructor(
    readonly code: RevertBlockedReason | "forbidden" | "invalid",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuditRevertError";
  }
}

async function assertStoreClient(storeId: string, clientId: string) {
  const store = await db.store.findFirst({
    where: { id: storeId, clientId },
    select: { id: true },
  });
  if (!store) throw new AuditRevertError("forbidden");
}

async function revertInventoryRemoved(
  entryId: string,
  storeId: string,
  clientId: string,
) {
  await assertStoreClient(storeId, clientId);
  const entry = await db.inventoryEntry.findFirst({
    where: { id: entryId, storeId, deletedAt: null },
  });
  if (!entry) throw new AuditRevertError("purged");
  if (!entry.removedAt) throw new AuditRevertError("conflict");
  await db.inventoryEntry.update({
    where: { id: entry.id },
    data: { removedAt: null },
  });
}

async function revertBuyListRemoved(
  entryId: string,
  storeId: string,
  clientId: string,
) {
  await assertStoreClient(storeId, clientId);
  const entry = await db.buyListEntry.findFirst({
    where: { id: entryId, storeId },
  });
  if (!entry) throw new AuditRevertError("purged");
  if (!entry.removedAt) throw new AuditRevertError("conflict");
  await db.buyListEntry.update({
    where: { id: entry.id },
    data: { removedAt: null },
  });
}

async function revertInventoryAdded(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const entry = await db.inventoryEntry.findFirst({
    where: { id: entryId, storeId, ...activeInventoryWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  const expectedQty = asNumber(payload.quantity);
  if (expectedQty !== null && entry.quantity !== expectedQty) {
    throw new AuditRevertError("conflict");
  }
  if (isAdhocBarcode(entry.barcode)) {
    await db.inventoryEntry.delete({ where: { id: entry.id } });
    await deleteLocalProductIfUnused(entry.productId);
  } else {
    await db.inventoryEntry.update({
      where: { id: entry.id },
      data: { removedAt: new Date() },
    });
  }
}

async function revertBuyListAdded(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const entry = await db.buyListEntry.findFirst({
    where: { id: entryId, storeId, ...activeBuyListWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  const expectedQty = asNumber(payload.quantity);
  if (expectedQty !== null && entry.quantity !== expectedQty) {
    throw new AuditRevertError("conflict");
  }
  if (isAdhocBarcode(entry.barcode)) {
    await db.buyListEntry.delete({ where: { id: entry.id } });
    await deleteLocalProductIfUnused(entry.productId);
  } else {
    await db.buyListEntry.update({
      where: { id: entry.id },
      data: { removedAt: new Date() },
    });
  }
}

async function revertInventoryMerged(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const addedQty = asNumber(payload.addedQty);
  if (addedQty === null || addedQty <= 0) throw new AuditRevertError("invalid");

  const entry = await db.inventoryEntry.findFirst({
    where: { id: entryId, storeId, ...activeInventoryWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  if (entry.quantity < addedQty) throw new AuditRevertError("conflict");

  const nextQty = entry.quantity - addedQty;
  if (nextQty <= 0) {
    if (isAdhocBarcode(entry.barcode)) {
      await db.inventoryEntry.delete({ where: { id: entry.id } });
      await deleteLocalProductIfUnused(entry.productId);
    } else {
      await db.inventoryEntry.update({
        where: { id: entry.id },
        data: { removedAt: new Date(), quantity: addedQty },
      });
    }
  } else {
    await db.inventoryEntry.update({
      where: { id: entry.id },
      data: { quantity: nextQty },
    });
  }

  const sourceEntryId = asString(payload.sourceEntryId);
  if (sourceEntryId) {
    const source = await db.inventoryEntry.findFirst({
      where: { id: sourceEntryId, storeId, deletedAt: null },
    });
    if (source?.removedAt) {
      await db.inventoryEntry.update({
        where: { id: source.id },
        data: { removedAt: null },
      });
    }
  }
}

async function revertBuyListMerged(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const addedQty = asNumber(payload.addedQty);
  if (addedQty === null || addedQty <= 0) throw new AuditRevertError("invalid");

  const entry = await db.buyListEntry.findFirst({
    where: { id: entryId, storeId, ...activeBuyListWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  if (entry.quantity < addedQty) throw new AuditRevertError("conflict");

  const nextQty = entry.quantity - addedQty;
  if (nextQty <= 0) {
    if (isAdhocBarcode(entry.barcode)) {
      await db.buyListEntry.delete({ where: { id: entry.id } });
      await deleteLocalProductIfUnused(entry.productId);
    } else {
      await db.buyListEntry.update({
        where: { id: entry.id },
        data: { removedAt: new Date(), quantity: addedQty },
      });
    }
  } else {
    await db.buyListEntry.update({
      where: { id: entry.id },
      data: { quantity: nextQty },
    });
  }
}

async function revertInventoryUpdated(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const beforeQty = asNumber(payload.beforeQty);
  const afterQty = asNumber(payload.afterQty);
  const beforeExpiry = asString(payload.beforeExpiry);
  const afterExpiry = asString(payload.afterExpiry);
  if (
    beforeQty === null ||
    afterQty === null ||
    !beforeExpiry ||
    !afterExpiry
  ) {
    throw new AuditRevertError("invalid");
  }

  const entry = await db.inventoryEntry.findFirst({
    where: { id: entryId, storeId, ...activeInventoryWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  if (entry.quantity !== afterQty || !sameExpiryDay(entry.expiryDate, afterExpiry)) {
    throw new AuditRevertError("conflict");
  }

  await db.inventoryEntry.update({
    where: { id: entry.id },
    data: {
      quantity: beforeQty,
      expiryDate: normalizeExpiryDate(new Date(beforeExpiry)),
    },
  });
}

async function revertBuyListUpdated(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
) {
  await assertStoreClient(storeId, clientId);
  const beforeQty = asNumber(payload.beforeQty);
  const afterQty = asNumber(payload.afterQty);
  if (beforeQty === null || afterQty === null) {
    throw new AuditRevertError("invalid");
  }

  const entry = await db.buyListEntry.findFirst({
    where: { id: entryId, storeId, ...activeBuyListWhere },
  });
  if (!entry) throw new AuditRevertError("missing");
  if (entry.quantity !== afterQty) throw new AuditRevertError("conflict");

  await db.buyListEntry.update({
    where: { id: entry.id },
    data: { quantity: beforeQty },
  });
}

async function revertInventoryPrice(
  entryId: string,
  storeId: string,
  clientId: string,
  payload: AuditRevertPayload,
  actorUserId: string,
  mode: "reduced" | "restored",
) {
  await assertStoreClient(storeId, clientId);
  const beforeDiscount =
    payload.beforeDiscount === null ? null : asNumber(payload.beforeDiscount);
  const afterDiscount =
    payload.afterDiscount === null ? null : asNumber(payload.afterDiscount);
  if (mode === "reduced" && afterDiscount === null) {
    throw new AuditRevertError("invalid");
  }
  if (mode === "restored" && beforeDiscount === null) {
    throw new AuditRevertError("invalid");
  }

  const entry = await db.inventoryEntry.findFirst({
    where: { id: entryId, storeId, ...activeInventoryWhere },
  });
  if (!entry) throw new AuditRevertError("missing");

  if (mode === "reduced") {
    if (entry.priceDiscountPercent !== afterDiscount) {
      throw new AuditRevertError("conflict");
    }
    if (beforeDiscount === null) {
      await db.inventoryEntry.update({
        where: { id: entry.id },
        data: priceReducedOffData(),
      });
    } else {
      await db.inventoryEntry.update({
        where: { id: entry.id },
        data: priceReducedOnData(actorUserId, beforeDiscount),
      });
    }
    return;
  }

  if (entry.priceReducedAt) throw new AuditRevertError("conflict");
  await db.inventoryEntry.update({
    where: { id: entry.id },
    data: priceReducedOnData(actorUserId, beforeDiscount as number),
  });
}

/** Apply the inverse of an audited mutation. Caller marks the audit + logs compensating event. */
export async function applyAuditRevert(
  row: RevertAuditRow,
  clientId: string,
  actorUserId: string,
): Promise<void> {
  const status = listRevertStatus(row);
  if (!status.revertible) {
    throw new AuditRevertError(status.revertBlockedReason ?? "not_supported");
  }
  if (row.user.clientId !== clientId) {
    throw new AuditRevertError("forbidden");
  }

  const payload = parseAuditPayload(row.payloadJson);
  if (!payload || !row.entityId) {
    throw new AuditRevertError("legacy");
  }

  const storeId = row.storeId ?? asString(payload.storeId);
  if (!storeId) throw new AuditRevertError("invalid");

  switch (row.event) {
    case "inventory_removed":
      await revertInventoryRemoved(row.entityId, storeId, clientId);
      return;
    case "buy_list_removed":
      await revertBuyListRemoved(row.entityId, storeId, clientId);
      return;
    case "inventory_added":
      await revertInventoryAdded(row.entityId, storeId, clientId, payload);
      return;
    case "buy_list_added":
      await revertBuyListAdded(row.entityId, storeId, clientId, payload);
      return;
    case "inventory_merged":
      await revertInventoryMerged(row.entityId, storeId, clientId, payload);
      return;
    case "buy_list_merged":
      await revertBuyListMerged(row.entityId, storeId, clientId, payload);
      return;
    case "inventory_updated":
      await revertInventoryUpdated(row.entityId, storeId, clientId, payload);
      return;
    case "buy_list_updated":
      await revertBuyListUpdated(row.entityId, storeId, clientId, payload);
      return;
    case "inventory_price_reduced":
      await revertInventoryPrice(
        row.entityId,
        storeId,
        clientId,
        payload,
        actorUserId,
        "reduced",
      );
      return;
    case "inventory_price_restored":
      await revertInventoryPrice(
        row.entityId,
        storeId,
        clientId,
        payload,
        actorUserId,
        "restored",
      );
      return;
    default:
      throw new AuditRevertError("not_supported");
  }
}
