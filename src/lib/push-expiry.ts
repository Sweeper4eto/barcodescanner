import { db } from "@/lib/db";
import { expiryListVisible, daysUntilExpiry } from "@/lib/expiry";
import {
  isPushConfigured,
  sendPushToSubscription,
  type PushPayload,
} from "@/lib/push";
import { t, type Locale } from "@/i18n";

const DIGEST_KIND = "expiry-digest";
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
const NOTIFY_WITHIN_DAYS = 28;

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
): PushPayload | null {
  if (items.length === 0) return null;

  const critical = items.filter((item) => item.daysUntilExpiry <= 7);
  const storeIds = [...new Set(items.map((item) => item.storeId))];
  const url =
    storeIds.length === 1
      ? `/app/expiry?storeId=${storeIds[0]}`
      : "/app";

  if (critical.length > 0) {
    const first = critical[0];
    const title =
      critical.length === 1
        ? t("push.digestCriticalSingle", { productName: first.productName }, locale)
        : t("push.digestCriticalMany", { count: critical.length }, locale);
    const body =
      critical.length === 1
        ? t(
            "push.digestCriticalSingleBody",
            {
              quantity: first.quantity,
              storeName: first.storeName,
              days: first.daysUntilExpiry,
            },
            locale,
          )
        : t(
            "push.digestCriticalManyBody",
            { productName: first.productName, storeName: first.storeName },
            locale,
          );
    return { title, body, url };
  }

  const first = items[0];
  return {
    title: t("push.digestSoonTitle", { count: items.length }, locale),
    body: t(
      "push.digestSoonBody",
      { productName: first.productName, storeName: first.storeName },
      locale,
    ),
    url,
  };
}

export function shouldSendDigest(
  lastSentAt: Date | null,
  now = new Date(),
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= MIN_INTERVAL_MS;
}

function subscriptionLocale(locale: string): Locale {
  return locale === "bg" ? "bg" : "en";
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

    const lastLog = await db.pushNotificationLog.findFirst({
      where: { userId: user.id, kind: DIGEST_KIND },
      orderBy: { sentAt: "desc" },
    });
    if (!shouldSendDigest(lastLog?.sentAt ?? null, now)) continue;

    const storeIds = user.storeLinks.map((link) => link.storeId);
    if (storeIds.length === 0) continue;

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
      .filter((item) => item.daysUntilExpiry <= NOTIFY_WITHIN_DAYS);

    let userSent = 0;

    for (const subscription of user.pushSubscriptions) {
      const payload = buildExpiryDigestPayload(
        items,
        subscriptionLocale(subscription.locale),
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
