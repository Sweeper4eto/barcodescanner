import { randomInt } from "node:crypto";
import type { MessageKey } from "@/i18n";
import { db } from "@/lib/db";

export const REGISTRATION_CODE_LENGTH = 8;

export function normalizeRegistrationCode(code: string): string {
  return code.trim().replace(/\s+/g, "");
}

export function validateRegistrationCodeFormat(
  code: string,
): MessageKey | null {
  const normalized = normalizeRegistrationCode(code);
  if (!normalized) return "auth.registrationCodeRequired";
  if (!/^\d+$/.test(normalized)) return "auth.registrationCodeDigitsOnly";
  if (normalized.length !== REGISTRATION_CODE_LENGTH) {
    return "auth.registrationCodeInvalid";
  }
  return null;
}

function generateNumericCode(): string {
  // 8 digits, allow leading zeros.
  let out = "";
  for (let i = 0; i < REGISTRATION_CODE_LENGTH; i += 1) {
    out += String(randomInt(0, 10));
  }
  return out;
}

export async function createRegistrationCode(options: {
  createdByUserId: string;
  note?: string;
}): Promise<{ id: string; code: string; createdAt: Date }> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = generateNumericCode();
    try {
      const row = await db.registrationCode.create({
        data: {
          code,
          createdByUserId: options.createdByUserId,
          note: (options.note ?? "").trim().slice(0, 200),
        },
        select: { id: true, code: true, createdAt: true },
      });
      return row;
    } catch {
      // Unique collision — retry.
    }
  }
  throw new Error("Could not allocate a unique registration code");
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Mark a code used inside an open transaction. Returns an error key if invalid.
 */
export async function consumeRegistrationCodeInTx(
  tx: Tx,
  rawCode: string,
  user: { id: string; username: string },
): Promise<MessageKey | null> {
  const formatError = validateRegistrationCodeFormat(rawCode);
  if (formatError) return formatError;
  const code = normalizeRegistrationCode(rawCode);

  const row = await tx.registrationCode.findUnique({ where: { code } });
  if (!row) return "auth.registrationCodeInvalid";
  if (row.usedAt) return "auth.registrationCodeUsed";

  const updated = await tx.registrationCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: {
      usedAt: new Date(),
      usedByUserId: user.id,
      usedByUsername: user.username,
    },
  });
  if (updated.count !== 1) return "auth.registrationCodeUsed";
  return null;
}
