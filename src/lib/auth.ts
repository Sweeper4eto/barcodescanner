import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  getSession,
  type SessionPayload,
} from "@/lib/session";
import type { MessageKey } from "@/i18n";
import type { User } from "@/generated/prisma/client";

export type AuthUser = Pick<
  User,
  "id" | "username" | "role" | "active" | "clientId"
>;

export type AuthFailure = {
  ok: false;
  errorKey: MessageKey;
  code?: "NO_CLIENT";
};

export async function registerUser(
  username: string,
  password: string,
): Promise<{ ok: true; user: AuthUser } | AuthFailure> {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3) {
    return { ok: false, errorKey: "auth.usernameTooShort" };
  }
  if (password.length < 6) {
    return { ok: false, errorKey: "auth.passwordTooShort" };
  }

  const existing = await db.user.findUnique({ where: { username: normalized } });
  if (existing) {
    return { ok: false, errorKey: "auth.usernameTaken" };
  }

  const user = await db.user.create({
    data: {
      username: normalized,
      passwordHash: await hashPassword(password),
      role: "USER",
    },
    select: { id: true, username: true, role: true, active: true, clientId: true },
  });

  return { ok: true, user };
}

export async function loginUser(
  username: string,
  password: string,
): Promise<
  | { ok: true; token: string; user: AuthUser }
  | AuthFailure
> {
  const normalized = username.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { username: normalized } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, errorKey: "auth.invalidCredentials" };
  }

  if (!user.active) {
    return { ok: false, errorKey: "auth.accountDeactivated" };
  }

  if (user.role === "USER" && !user.clientId) {
    return {
      ok: false,
      code: "NO_CLIENT",
      errorKey: "auth.noClientAssigned",
    };
  }

  if (user.role === "USER" && user.clientId) {
    const client = await db.client.findUnique({ where: { id: user.clientId } });
    if (!client?.active) {
      return { ok: false, errorKey: "auth.clientDeactivated" };
    }
  }

  const payload: SessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    clientId: user.clientId,
  };

  return {
    ok: true,
    token: await createSessionToken(payload),
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      active: user.active,
      clientId: user.clientId,
    },
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export { paymentAmount, expiryListVisible } from "@/lib/expiry";
