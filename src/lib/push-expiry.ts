import { db } from "@/lib/db";
import {
  clientDefaultsFromRow,
  mergeClientDefaults,
  prefsFromUserRow,
  resolveNotifyStoreIds,
  shouldSendNotificationNow,
  splitItemsByTier,
  type DigestTier,
  type ExpiryNotificationPrefs,
} from "@/lib/expiry-notification-prefs";
import { expiryListVisible, daysUntilExpiry } from "@/lib/expiry";
import {
  isPushConfigured,
  sendPushToSubscription,
  type PushPayload,
} from "@/lib/push";
import { t, type Locale } from "@/i18n";

const DIGEST_KIND = "expiry-digest";

export type ExpiryDigestItem = {
  productName: string;
  storeName: string;
  storeId: string;
  quantity: number;
  daysUntilExpiry: number;
};

export { daysUntilExpiry } from "@/lib/expiry";

export function buildExpiryDigestPayload(
  items: ExpiryDigestItem[],
  locale: Locale = "en",
  options?: { tier?: DigestTier; withinDays?: number },
): PushPayload | null {
  if (items.length === 0) return null;

  const tier = options?.tier ?? "urgent";
  const withinDays = options?.withinDays ?? 3;

  const storeIds = [...new Set(items.map((item) => item.storeId))];
  const url =
    storeIds.length === 1
      ? `/app/expiry?storeId=${storeIds[0]}`
      : "/app";

  if (tier === "urgent") {
    const first = items[0];
    const title =
      items.length === 1
        ? t("push.digestUrgentSingle", { productName: first.productName }, locale)
        : t("push.digestUrgentMany", { count: items.length, days: withinDays }, locale);
    const body =
      items.length === 1
        ? t(
            "push.digestUrgentSingleBody",
            {
              quantity: first.quantity,
              storeName: first.storeName,
              days: first.daysUntilExpiry,
            },
            locale,
          )
        : t(
            "push.digestUrgentManyBody",
            { productName: first.productName, storeName: first.storeName },
            locale,
          );
    return { title, body, url };
  }

  const first = items[0];
  return {
    title: t("push.digestEarlyMany", { count: items.length, days: withinDays }, locale),
    body: t(
      "push.digestEarlyBody",
      { productName: first.productName, storeName: first.storeName },
      locale,
    ),
    url,
  };
}

/** @deprecated Use shouldSendNotificationNow with user prefs instead. */
export function shouldSendDigest(
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  const minMs = 20 * 60 * 60 * 1000;
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= minMs;
}

function subscriptionLocale(locale: string): Locale {
  return locale === "bg" ? "bg" : "en";
}

const userPrefsSelect = {
  expiryNotifyEarlyEnabled: true,
  expiryNotifyEarlyDays: true,
  expiryNotifyUrgentEnabled: true,
  expiryNotifyUrgentDays: true,
  expiryNotifySchedule: true,
  expiryNotifyTime1: true,
  expiryNotifyTime2: true,
  expiryNotifyMinIntervalHours: true,
  expiryQuietHoursEnabled: true,
  expiryQuietHoursStart: true,
  expiryQuietHoursEnd: true,
  expiryNotifyTimezone: true,
  expiryNotifyStoreIdsJson: true,
  expiryNotifyPrefsCustomized: true,
  client: {
    select: {
      expiryDefaultEarlyDays: true,
      expiryDefaultUrgentDays: true,
      expiryDefaultSchedule: true,
      expiryDefaultTime1: true,
      expiryDefaultTime2: true,
      expiryDefaultMinIntervalHours: true,
      expiryDefaultQuietEnabled: true,
      expiryDefaultQuietStart: true,
      expiryDefaultQuietEnd: true,
      expiryDefaultTimezone: true,
    },
  },
} as const;

function resolveUserPrefs(
  user: {
    expiryNotifyEarlyEnabled: boolean;
    expiryNotifyEarlyDays: number;
    expiryNotifyUrgentEnabled: boolean;
    expiryNotifyUrgentDays: number;
    expiryNotifySchedule: string;
    expiryNotifyTime1: string;
    expiryNotifyTime2: string;
    expiryNotifyMinIntervalHours: number;
    expiryQuietHoursEnabled: boolean;
    expiryQuietHoursStart: string;
    expiryQuietHoursEnd: string;
    expiryNotifyTimezone: string;
    expiryNotifyStoreIdsJson: string | null;
    expiryNotifyPrefsCustomized: boolean;
    client: {
      expiryDefaultEarlyDays: number | null;
      expiryDefaultUrgentDays: number | null;
      expiryDefaultSchedule: string | null;
      expiryDefaultTime1: string | null;
      expiryDefaultTime2: string | null;
      expiryDefaultMinIntervalHours: number | null;
      expiryDefaultQuietEnabled: boolean | null;
      expiryDefaultQuietStart: string | null;
      expiryDefaultQuietEnd: string | null;
      expiryDefaultTimezone: string | null;
    } | null;
  },
): ExpiryNotificationPrefs {
  const base = prefsFromUserRow(user);
  return mergeClientDefaults(base, clientDefaultsFromRow(user.client ?? undefined));
}

export async function sendExpiryDigests(): Promise<{
  users: number;
  sent: number;
  skipped: boolean;
}> {
  if (!isPushConfigured()) {
    return { users: 0, sent: 0, skipped: true };
  }

  const now = new Date();
  const users = await db.user.findMany({
    where: { active: true, role: "USER", clientId: { not: null } },
    select: {
      id: true,
      ...userPrefsSelect,
      pushSubscriptions: {
        select: {
          id: true,
          endpoint: true,
          p256dh: true,
          auth: true,
          locale: true,
        },
      },
      storeLinks: {
        where: { store: { active: true } },
        select: { storeId: true },
      },
    },
  });

  let usersNotified = 0;
  let totalSent = 0;

  for (const user of users) {
    if (user.pushSubscriptions.length === 0) continue;

    const prefs = resolveUserPrefs(user);

    const lastLog = await db.pushNotificationLog.findFirst({
      where: { userId: user.id, kind: DIGEST_KIND },
      orderBy: { sentAt: "desc" },
    });

    if (!shouldSendNotificationNow(prefs, lastLog?.sentAt ?? null, now)) {
      continue;
    }

    const assignedStoreIds = user.storeLinks.map((link) => link.storeId);
    const storeIds = resolveNotifyStoreIds(prefs, assignedStoreIds);
    if (storeIds.length === 0) continue;

    const maxDays = Math.max(
      prefs.earlyEnabled ? prefs.earlyDays : 0,
      prefs.urgentEnabled ? prefs.urgentDays : 0,
    );
    if (maxDays <= 0) continue;

    const entries = await db.inventoryEntry.findMany({
      where: {
        storeId: { in: storeIds },
        removedAt: null,
        deletedAt: null,
      },
      include: { product: true, store: true },
      orderBy: { expiryDate: "asc" },
    });

    const items: ExpiryDigestItem[] = entries
      .filter((entry) => expiryListVisible(entry.expiryDate, now))
      .map((entry) => ({
        productName: entry.product.name,
        storeName: entry.store.name,
        storeId: entry.storeId,
        quantity: entry.quantity,
        daysUntilExpiry: daysUntilExpiry(entry.expiryDate, now),
      }))
      .filter((item) => item.daysUntilExpiry <= maxDays);

    const tiered = splitItemsByTier(items, prefs);
    if (!tiered) continue;

    const digestItems = tiered.items as ExpiryDigestItem[];
    let userSent = 0;

    for (const subscription of user.pushSubscriptions) {
      const payload = buildExpiryDigestPayload(
        digestItems,
        subscriptionLocale(subscription.locale),
        { tier: tiered.tier, withinDays: tiered.withinDays },
      );
      if (!payload) continue;

      const result = await sendPushToSubscription(subscription, payload);
      if (result === "sent") {
        userSent += 1;
        totalSent += 1;
      }
    }

    if (userSent > 0) {
      usersNotified += 1;
      await db.pushNotificationLog.create({
        data: { userId: user.id, kind: DIGEST_KIND },
      });
    }
  }

  return { users: usersNotified, sent: totalSent, skipped: false };
}

export { userPrefsSelect };
