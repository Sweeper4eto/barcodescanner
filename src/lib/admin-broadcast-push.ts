import { db } from "@/lib/db";
import {
  isPushConfigured,
  sendPushToSubscription,
  type PushPayload,
} from "@/lib/push";

export type BroadcastAudience = "all" | "owners" | "members";

export type BroadcastPushInput = {
  audience: BroadcastAudience;
  titleEn: string;
  titleBg: string;
  bodyEn: string;
  bodyBg: string;
  /** App path only, e.g. `/app`. */
  url?: string;
};

export type BroadcastPushResult = {
  users: number;
  sent: number;
  failed: number;
  removed: number;
  skipped: boolean;
};

function audienceFilter(audience: BroadcastAudience) {
  if (audience === "owners") {
    return { clientRole: { in: ["OWNER", "STORE_MANAGER"] as const } };
  }
  if (audience === "members") return { clientRole: "MEMBER" as const };
  return {};
}

function payloadForLocale(
  input: BroadcastPushInput,
  locale: string,
): PushPayload {
  const bg = locale === "bg";
  return {
    title: (bg ? input.titleBg : input.titleEn).trim(),
    body: (bg ? input.bodyBg : input.bodyEn).trim(),
    url: input.url?.startsWith("/") ? input.url : "/app",
  };
}

/** How many active app users with a push subscription match the audience. */
export async function countBroadcastPushAudience(
  audience: BroadcastAudience,
): Promise<number> {
  return db.user.count({
    where: {
      active: true,
      role: "USER",
      clientId: { not: null },
      pushSubscriptions: { some: {} },
      ...audienceFilter(audience),
    },
  });
}

/**
 * Send a one-off admin push to retail/household app users (not admins).
 * Uses each subscription's saved locale for EN vs BG text.
 */
export async function sendAdminBroadcastPush(
  input: BroadcastPushInput,
): Promise<BroadcastPushResult> {
  if (!isPushConfigured()) {
    return { users: 0, sent: 0, failed: 0, removed: 0, skipped: true };
  }

  const users = await db.user.findMany({
    where: {
      active: true,
      role: "USER",
      clientId: { not: null },
      pushSubscriptions: { some: {} },
      ...audienceFilter(input.audience),
    },
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
    },
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;
  let usersNotified = 0;

  for (const user of users) {
    let userSent = 0;
    for (const subscription of user.pushSubscriptions) {
      const payload = payloadForLocale(input, subscription.locale);
      const outcome = await sendPushToSubscription(subscription, payload);
      if (outcome === "sent") {
        sent += 1;
        userSent += 1;
      } else if (outcome === "failed") {
        failed += 1;
      } else {
        removed += 1;
      }
    }
    if (userSent > 0) {
      usersNotified += 1;
      await db.pushNotificationLog.create({
        data: { userId: user.id, kind: "admin_broadcast" },
      });
    }
  }

  return {
    users: usersNotified,
    sent,
    failed,
    removed,
    skipped: false,
  };
}
