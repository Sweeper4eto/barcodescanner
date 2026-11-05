import { Prisma } from "@/generated/prisma/client";
import { AUDIT_DETAILS_MAX } from "@/lib/audit-details";
import {
  type AuditMutationMeta,
  listRevertStatus,
  serializeAuditPayload,
} from "@/lib/audit-revert";
import { db } from "@/lib/db";
import {
  normalizeSearchText,
  sqlContainsPattern,
  sqlFoldColumn,
} from "@/lib/search-text";

export type AuditEvent =
  | "login"
  | "login_failed"
  | "logout"
  | "register"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "store_created"
  | "store_updated"
  | "store_deleted"
  | "user_updated"
  | "user_deleted"
  | "user_password_set"
  | "user_password_changed"
  | "payment_recorded"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "inventory_added"
  | "inventory_merged"
  | "inventory_removed"
  | "inventory_updated"
  | "inventory_price_reduced"
  | "inventory_price_restored"
  | "buy_list_added"
  | "buy_list_merged"
  | "buy_list_removed"
  | "buy_list_updated"
  | "activity_reverted";

export type AuditFilter = "all" | "auth" | "inventory" | "products" | "admin";

export const AUDIT_PAGE_SIZES = [10, 20, 50] as const;

const AUTH_EVENTS: AuditEvent[] = [
  "login",
  "login_failed",
  "logout",
  "register",
  "user_password_changed",
];
const INVENTORY_EVENTS: AuditEvent[] = [
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
  "activity_reverted",
];
const PRODUCT_EVENTS: AuditEvent[] = [
  "product_created",
  "product_updated",
  "product_deleted",
];
const ADMIN_EVENTS: AuditEvent[] = [
  "client_created",
  "client_updated",
  "client_deleted",
  "store_created",
  "store_updated",
  "store_deleted",
  "user_updated",
  "user_deleted",
  "user_password_set",
  "payment_recorded",
];

function normalizeClientIp(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "unknown") return null;
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidates = [
    ...(forwarded ? forwarded.split(",") : []),
    request.headers.get("x-real-ip") ?? "",
    request.headers.get("cf-connecting-ip") ?? "",
  ];
  for (const candidate of candidates) {
    const normalized = normalizeClientIp(candidate);
    if (normalized) return normalized;
  }
  return "Unknown";
}

export function describeClientDevice(request: Request): string {
  const ua = (request.headers.get("user-agent") ?? "").trim();
  if (!ua) return "Unknown device";

  const tablet = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua);
  const mobile =
    !tablet &&
    /mobile|android|iphone|ipod|webos|blackberry|iemobile|opera mini/i.test(ua);

  let os = "Unknown OS";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua) && !/iphone|ipad|ipod/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/cros/i.test(ua)) os = "Chrome OS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  const deviceType = tablet ? "Tablet" : mobile ? "Mobile" : "Desktop";
  return `${deviceType} · ${os} · ${browser}`;
}

type AuditActor = { id: string; username: string } | { userId: string; username: string };

function auditActor(actor: AuditActor) {
  return "userId" in actor
    ? { id: actor.userId, username: actor.username }
    : actor;
}

export async function logAuditEvent(
  request: Request,
  user: AuditActor,
  event: AuditEvent,
  details = "",
  meta?: AuditMutationMeta,
): Promise<string | null> {
  const actor = auditActor(user);
  try {
    const row = await db.auditLog.create({
      data: {
        userId: actor.id,
        username: actor.username,
        event,
        ipAddress: getClientIp(request),
        deviceInfo: describeClientDevice(request),
        details: details.slice(0, AUDIT_DETAILS_MAX),
        ...(meta
          ? {
              entityType: meta.entityType,
              entityId: meta.entityId,
              storeId: meta.storeId ?? null,
              payloadJson: serializeAuditPayload(meta.payload),
              revertsAuditId: meta.revertsAuditId ?? null,
            }
          : {}),
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.error("audit log write failed:", error);
    return null;
  }
}

/**
 * Persist a failed login attempt (username tried + reason). Never logs passwords.
 * Links userId when the attempted username matches an existing account.
 */
export async function logFailedLoginAttempt(
  request: Request,
  attemptedUsername: string,
  details = "",
): Promise<void> {
  const normalized = attemptedUsername.trim().toLowerCase().slice(0, 64);
  const username = normalized || "(empty)";
  try {
    const existing = normalized
      ? await db.user.findUnique({
          where: { username: normalized },
          select: { id: true },
        })
      : null;
    await db.auditLog.create({
      data: {
        userId: existing?.id ?? null,
        username,
        event: "login_failed",
        ipAddress: getClientIp(request),
        deviceInfo: describeClientDevice(request),
        details: details.slice(0, AUDIT_DETAILS_MAX),
      },
    });
  } catch (error) {
    console.error("audit log write failed:", error);
  }
}

function parseAuditDateBound(value: string, endOfDay: boolean): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(endOfDay ? `${v}T23:59:59.999` : `${v}T00:00:00.000`);
}

function parseAuditTime(value: string): string | null {
  const v = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
  return v;
}

function eventsForFilter(filter: AuditFilter): AuditEvent[] | null {
  switch (filter) {
    case "auth":
      return AUTH_EVENTS;
    case "inventory":
      return INVENTORY_EVENTS;
    case "products":
      return PRODUCT_EVENTS;
    case "admin":
      return ADMIN_EVENTS;
    default:
      return null;
  }
}

export type AuditAccountKind = "business" | "household";

/** Events owners may see in Team → Activity (no billing / other-account admin). */
export const OWNER_ACTIVITY_EVENTS: AuditEvent[] = [
  ...AUTH_EVENTS.filter((event) => event !== "login_failed"),
  ...INVENTORY_EVENTS,
  ...PRODUCT_EVENTS,
  "user_updated",
  "user_deleted",
];

export type OwnerActivityFilter = "all" | "auth" | "inventory" | "products";

export type AuditLogQuery = {
  filter?: AuditFilter;
  q?: string;
  accountKind?: AuditAccountKind;
  clientId?: string;
  username?: string;
  store?: string;
  ip?: string;
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  page?: number;
  pageSize?: number;
  /** Extra hard allowlist (e.g. owner activity). Intersected with filter events. */
  eventsAllowlist?: AuditEvent[];
};

/** Match store name as written in audit details (`store "Name"`). */
export function auditStoreDetailsNeedle(storeName: string): string {
  return `store "${storeName.trim()}"`;
}

export function buildAuditLogWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
  const filter = query.filter ?? "all";
  const events = eventsForFilter(filter);
  const and: Prisma.AuditLogWhereInput[] = [];

  const allowlist = query.eventsAllowlist?.length
    ? query.eventsAllowlist
    : null;
  if (events && allowlist) {
    const allowed = new Set(allowlist);
    and.push({ event: { in: events.filter((event) => allowed.has(event)) } });
  } else if (events) {
    and.push({ event: { in: events } });
  } else if (allowlist) {
    and.push({ event: { in: allowlist } });
  }

  const clientId = query.clientId?.trim();
  if (clientId) {
    and.push({ user: { clientId } });
  } else if (query.accountKind === "household") {
    and.push({ user: { client: { homeUser: true } } });
  } else if (query.accountKind === "business") {
    and.push({ user: { client: { homeUser: false } } });
  }

  const username = query.username?.trim();
  if (username) {
    and.push({ username: { equals: username } });
  }

  const store = query.store?.trim();
  if (store) {
    and.push({ details: { contains: auditStoreDetailsNeedle(store) } });
  }

  const ip = query.ip?.trim();
  if (ip) {
    and.push({ ipAddress: { contains: ip } });
  }

  // Free-text `q` is applied in queryAuditLog with Unicode-aware matching
  // (SQLite LIKE is ASCII-only case-insensitive).

  if (query.dateFrom) {
    const timeFrom = query.timeFrom ? parseAuditTime(query.timeFrom) : null;
    const start = timeFrom
      ? new Date(`${query.dateFrom.trim()}T${timeFrom}:00.000`)
      : parseAuditDateBound(query.dateFrom, false);
    if (start) and.push({ occurredAt: { gte: start } });
  }

  if (query.dateTo) {
    const timeTo = query.timeTo ? parseAuditTime(query.timeTo) : null;
    const end = timeTo
      ? new Date(`${query.dateTo.trim()}T${timeTo}:59.999`)
      : parseAuditDateBound(query.dateTo, true);
    if (end) and.push({ occurredAt: { lte: end } });
  }

  return and.length ? { AND: and } : {};
}

export async function getAuditFilterOptions(opts?: {
  clientId?: string;
  accountKind?: AuditAccountKind;
}) {
  const clientFilter = opts?.clientId?.trim() || null;
  const accountKind = opts?.accountKind;
  const homeUser =
    accountKind === "household"
      ? true
      : accountKind === "business"
        ? false
        : null;

  const clientWhere =
    homeUser === null ? undefined : ({ homeUser } as const);
  const storeWhere = clientFilter
    ? { clientId: clientFilter }
    : homeUser === null
      ? undefined
      : { client: { homeUser } };

  const [clients, scopedUsers, stores] = await Promise.all([
    db.client.findMany({
      where: clientWhere,
      select: { id: true, name: true, homeUser: true, active: true },
      orderBy: { name: "asc" },
    }),
    clientFilter
      ? db.user.findMany({
          where: { clientId: clientFilter, role: "USER" },
          select: { username: true },
          orderBy: { username: "asc" },
        })
      : db.user.findMany({
          where: {
            role: "USER",
            ...(homeUser === null
              ? { clientId: { not: null } }
              : { client: { homeUser } }),
          },
          select: { username: true },
          orderBy: { username: "asc" },
        }),
    db.store.findMany({
      where: storeWhere,
      select: {
        id: true,
        name: true,
        active: true,
        client: { select: { name: true } },
      },
      orderBy: [{ client: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return {
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      homeUser: client.homeUser,
      active: client.active,
    })),
    usernames: [
      ...new Set(
        scopedUsers
          .map((row) => row.username)
          .filter((name) => name.trim().length > 0),
      ),
    ].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
    ),
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      active: store.active,
      clientName: store.client.name,
    })),
  };
}

export async function queryAuditLog(query: AuditLogQuery) {
  const pageSizeRaw = query.pageSize ?? 20;
  const pageSize = (AUDIT_PAGE_SIZES as readonly number[]).includes(pageSizeRaw)
    ? pageSizeRaw
    : 20;
  let page = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const where = buildAuditLogWhere(query);
  const needle = normalizeSearchText(query.q ?? "");

  let textWhere: Prisma.AuditLogWhereInput = where;
  if (needle) {
    const pattern = sqlContainsPattern(needle);
    const matched = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM AuditLog
      WHERE ${sqlFoldColumn("username")} LIKE ${pattern}
         OR ${sqlFoldColumn("event")} LIKE ${pattern}
         OR ${sqlFoldColumn("details")} LIKE ${pattern}
         OR ${sqlFoldColumn("ipAddress")} LIKE ${pattern}
         OR ${sqlFoldColumn("deviceInfo")} LIKE ${pattern}
    `);
    textWhere = {
      AND: [where, { id: { in: matched.map((row) => row.id) } }],
    };
  }

  const total = await db.auditLog.count({ where: textWhere });
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);
  if (page > totalPages) page = totalPages;

  const entries = await db.auditLog.findMany({
    where: textWhere,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      userId: true,
      username: true,
      event: true,
      ipAddress: true,
      deviceInfo: true,
      details: true,
      occurredAt: true,
      entityType: true,
      entityId: true,
      storeId: true,
      payloadJson: true,
      revertedAt: true,
      revertsAuditId: true,
    },
  });

  return { entries, total, page, totalPages, pageSize };
}

export function serializeAuditEntries(
  entries: Awaited<ReturnType<typeof queryAuditLog>>["entries"],
  options?: { includeRevertStatus?: boolean },
) {
  return entries.map((entry) => {
    const {
      payloadJson: _payload,
      entityType,
      entityId,
      storeId,
      revertedAt,
      revertsAuditId,
      ...publicFields
    } = entry;
    void _payload;

    const base = {
      ...publicFields,
      occurredAt: entry.occurredAt.toISOString(),
      revertedAt: revertedAt?.toISOString() ?? null,
      revertsAuditId,
    };

    if (!options?.includeRevertStatus) {
      return base;
    }

    const status = listRevertStatus(entry);
    return {
      ...base,
      entityType,
      entityId,
      storeId,
      revertible: status.revertible,
      revertBlockedReason: status.revertBlockedReason ?? null,
    };
  });
}

/** Admin-only: resolve business/household account name for each entry's acting user. */
export async function attachAccountNamesToAuditEntries<
  T extends { userId: string | null },
>(entries: T[]): Promise<Array<T & { accountName: string | null }>> {
  if (entries.length === 0) {
    return [];
  }

  const userIds = [
    ...new Set(
      entries
        .map((entry) => entry.userId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actors =
    userIds.length === 0
      ? []
      : await db.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            client: { select: { name: true } },
          },
        });
  const accountNameByUserId = new Map(
    actors.map((row) => [row.id, row.client?.name ?? null] as const),
  );

  return entries.map((entry) => ({
    ...entry,
    accountName: entry.userId
      ? (accountNameByUserId.get(entry.userId) ?? null)
      : null,
  }));
}
