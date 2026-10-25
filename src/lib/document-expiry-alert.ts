import { readFile } from "fs/promises";
import type { DocumentOcrRow } from "@/lib/document-ai";
import { db } from "@/lib/db";
import { isPushConfigured, sendPushToUser } from "@/lib/push";
import { formatSupportTicketNumber } from "@/lib/support-ticket";
import { resolveLocalUploadPath, saveUploadBuffer } from "@/lib/upload";

export const DOCUMENT_EXPIRY_ALERT_TOPIC = "ocr_expiry_alert";

const ALERT_TIME_ZONE = "Europe/Sofia";

function todayYmdInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Same day one calendar month earlier (31 Mar → 28/29 Feb). */
export function oneMonthBeforeYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 2, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Rows whose expiry is more than one month in the past on the scan day —
 * usually a misread date (e.g. 30.01.2026 instead of 30.08.2027).
 */
export function findLongExpiredDocumentRows(
  rows: DocumentOcrRow[],
  now: Date = new Date(),
): DocumentOcrRow[] {
  const cutoff = oneMonthBeforeYmd(todayYmdInZone(now, ALERT_TIME_ZONE));
  return rows.filter(
    (row) =>
      typeof row.expiryYmd === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.expiryYmd) &&
      row.expiryYmd < cutoff,
  );
}

/** Bytes of the scanned photo, read before the temporary upload is deleted. */
export async function readDocumentAlertImage(source: {
  dataUrl?: string;
  imagePath?: string;
}): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    if (source.dataUrl) {
      const match = /^data:image\/([\w+-]+);base64,([\s\S]+)$/.exec(
        source.dataUrl.trim(),
      );
      if (!match) return null;
      return {
        buffer: Buffer.from(match[2], "base64"),
        ext: match[1].toLowerCase(),
      };
    }
    if (source.imagePath) {
      const filePath = await resolveLocalUploadPath(source.imagePath);
      if (!filePath) return null;
      return {
        buffer: await readFile(filePath),
        ext: filePath.split(".").pop()?.toLowerCase() ?? "",
      };
    }
  } catch (error) {
    console.error("document expiry alert: reading scanned photo failed", error);
  }
  return null;
}

function formatYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return `${day}.${month}.${year}`;
}

function alertMessage(input: {
  username: string;
  storeName: string;
  flagged: DocumentOcrRow[];
  totalRows: number;
}): string {
  const lines = input.flagged.map((row) => {
    const parts = [row.name || "(no name)"];
    if (row.articul) parts.push(`SKU ${row.articul}`);
    if (row.barcode) parts.push(`EAN ${row.barcode}`);
    parts.push(`qty ${row.quantity}`);
    parts.push(`expiry ${formatYmd(row.expiryYmd!)}`);
    return `- ${parts.join(" · ")}`;
  });
  return [
    `Document scan by ${input.username} in store "${input.storeName}" read ${input.flagged.length} of ${input.totalRows} rows with an expiry date more than 1 month in the past.`,
    "Check whether the date was misread before it is imported.",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Open an admin support ticket with an admin-only copy of the scanned photo.
 * Never throws — a failed alert must not break the user's scan.
 */
export async function createDocumentExpiryAlert(input: {
  userId: string;
  username: string;
  clientId: string | null;
  storeId: string;
  storeName: string;
  rows: DocumentOcrRow[];
  image: { buffer: Buffer; ext: string } | null;
}): Promise<void> {
  const flagged = findLongExpiredDocumentRows(input.rows);
  if (flagged.length === 0) return;

  let documentImagePath: string | null = null;
  try {
    if (input.image) {
      // No owner file: only admins can open the copy via /uploads/….
      documentImagePath = await saveUploadBuffer(
        input.image.buffer,
        input.image.ext,
      );
    }
  } catch (error) {
    console.error("document expiry alert: saving document copy failed", error);
  }

  let ticketId: string;
  try {
    const row = await db.supportRequest.create({
      data: {
        userId: input.userId,
        clientId: input.clientId,
        storeId: input.storeId,
        topic: DOCUMENT_EXPIRY_ALERT_TOPIC,
        message: alertMessage({
          username: input.username,
          storeName: input.storeName,
          flagged,
          totalRows: input.rows.length,
        }),
        documentImagePath,
      },
      select: { id: true },
    });
    ticketId = row.id;
  } catch (error) {
    console.error("document expiry alert: creating ticket failed", error);
    return;
  }

  const ticketNumber = formatSupportTicketNumber(ticketId);
  console.warn(
    `document expiry alert: ${ticketNumber} store=${input.storeId} user=${input.username} flagged=${flagged.length}`,
  );

  if (!isPushConfigured()) return;
  try {
    const admins = await db.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    const first = flagged[0];
    const payload = {
      title: `expire365 — ${ticketNumber}`,
      body: `${input.username} (${input.storeName}): ${flagged.length} scanned item(s) expired over a month ago, e.g. ${first.name} ${formatYmd(first.expiryYmd!)}`,
      url: "/admin",
    };
    for (const admin of admins) {
      await sendPushToUser(admin.id, payload).catch((error) => {
        console.error("document expiry alert push failed", admin.id, error);
      });
    }
  } catch (error) {
    console.error("document expiry alert: notifying admins failed", error);
  }
}
