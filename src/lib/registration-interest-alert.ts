import { db } from "@/lib/db";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { formatSupportTicketNumber } from "@/lib/support-ticket";

export const REGISTER_INTEREST_TOPIC = "register_interest";

/** Avoid spamming admins for the same visitor IP. */
const OPEN_COOLDOWN_MS = 60 * 60 * 1000;
const FILL_COOLDOWN_MS = 15 * 60 * 1000;

export type RegisterInterestFields = {
  organizationName?: string;
  username?: string;
  email?: string;
  /** Whether a registration code was typed (never store the code itself). */
  registrationCodeEntered?: boolean;
};

function trimField(value: string | undefined, max = 80): string {
  return (value ?? "").trim().slice(0, max);
}

function summarizeFields(fields: RegisterInterestFields | undefined): string[] {
  if (!fields) return [];
  const lines: string[] = [];
  const org = trimField(fields.organizationName);
  const username = trimField(fields.username, 40);
  const email = trimField(fields.email, 120);
  if (org) lines.push(`Name: ${org}`);
  if (username) lines.push(`Username: ${username}`);
  if (email) lines.push(`Email: ${email}`);
  if (fields.registrationCodeEntered) {
    lines.push("Registration code: entered (digits hidden)");
  }
  return lines;
}

function openMessage(input: {
  ip: string;
  device: string;
}): string {
  return [
    "Someone opened the Register page.",
    `IP: ${input.ip}`,
    `Device: ${input.device}`,
    "",
    "No form fields filled yet.",
  ].join("\n");
}

function fillMessage(input: {
  ip: string;
  device: string;
  fields: RegisterInterestFields;
}): string {
  const filled = summarizeFields(input.fields);
  return [
    "Someone is filling the Register form.",
    `IP: ${input.ip}`,
    `Device: ${input.device}`,
    "",
    filled.length > 0 ? "Entered so far:" : "Fields were touched but empty after trim.",
    ...filled.map((line) => `- ${line}`),
  ].join("\n");
}

async function recentTicketExists(options: {
  ip: string;
  event: "open" | "fill";
  cooldownMs: number;
}): Promise<boolean> {
  const since = new Date(Date.now() - options.cooldownMs);
  const needle =
    options.event === "open"
      ? "Someone opened the Register page."
      : "Someone is filling the Register form.";
  const rows = await db.supportRequest.findMany({
    where: {
      topic: REGISTER_INTEREST_TOPIC,
      createdAt: { gte: since },
      message: { contains: `IP: ${options.ip}` },
    },
    select: { message: true },
    take: 20,
  });
  return rows.some((row) => row.message.includes(needle));
}

async function pushAdmins(payload: {
  title: string;
  body: string;
}): Promise<void> {
  if (!isPushConfigured()) return;
  try {
    const admins = await db.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    for (const admin of admins) {
      await sendPushToUser(admin.id, {
        ...payload,
        url: "/admin",
      }).catch((error) => {
        console.error("register interest alert push failed", admin.id, error);
      });
    }
  } catch (error) {
    console.error("register interest alert: notifying admins failed", error);
  }
}

/**
 * Log register page open / form fill for admins (support ticket + push),
 * same pattern as document expiry alerts. Never throws.
 */
export async function reportRegisterInterest(input: {
  event: "open" | "fill";
  ip: string;
  device: string;
  fields?: RegisterInterestFields;
}): Promise<{ created: boolean; ticketId?: string }> {
  try {
    const ip = (input.ip || "Unknown").trim() || "Unknown";
    const device = (input.device || "Unknown device").trim() || "Unknown device";
    const cooldownMs =
      input.event === "open" ? OPEN_COOLDOWN_MS : FILL_COOLDOWN_MS;

    if (
      await recentTicketExists({
        ip,
        event: input.event,
        cooldownMs,
      })
    ) {
      return { created: false };
    }

    if (input.event === "fill") {
      const filled = summarizeFields(input.fields);
      if (filled.length === 0) return { created: false };
    }

    const message =
      input.event === "open"
        ? openMessage({ ip, device })
        : fillMessage({
            ip,
            device,
            fields: input.fields ?? {},
          });

    const row = await db.supportRequest.create({
      data: {
        topic: REGISTER_INTEREST_TOPIC,
        message,
        status: "new",
      },
      select: { id: true },
    });

    const ticketNumber = formatSupportTicketNumber(row.id);
    console.warn(
      `register interest alert: ${ticketNumber} event=${input.event} ip=${ip}`,
    );

    const body =
      input.event === "open"
        ? `Register page opened · IP ${ip}`
        : `Register form filled · IP ${ip}`;

    await pushAdmins({
      title: `expire365 — ${ticketNumber}`,
      body,
    });

    return { created: true, ticketId: row.id };
  } catch (error) {
    console.error("register interest alert failed", error);
    return { created: false };
  }
}
