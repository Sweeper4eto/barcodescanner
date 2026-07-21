import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createSessionToken,
  getSession,
  type SessionPayload,
} from "@/lib/session";
import type { MessageKey } from "@/i18n";
import type { ClientRole, User } from "@/generated/prisma/client";

export type AuthUser = Pick<
  User,
  "id" | "username" | "role" | "active" | "clientId" | "clientRole"
>;

export type AuthFailure = {
  ok: false;
  errorKey: MessageKey;
  code?: "NO_CLIENT";
};

export type RegisterAccountType = "home" | "retail";

export type RegisterOptions = {
  accountType: RegisterAccountType;
  organizationName?: string;
};

function defaultOrgName(username: string, accountType: RegisterAccountType): string {
  if (accountType === "home") {
    return `${username}'s household`;
  }
  return `${username}'s store`;
}

function defaultStoreName(accountType: RegisterAccountType): string {
  return accountType === "home" ? "Home" : "Main store";
}

export async function registerUser(
  username: string,
  password: string,
  options: RegisterOptions,
): Promise<{ ok: true; user: AuthUser; token: string } | AuthFailure> {
  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3) {
    return { ok: false, errorKey: "auth.usernameTooShort" };
  }
  if (password.length < 6) {
    return { ok: false, errorKey: "auth.passwordTooShort" };
  }
  if (password.length > 72) {
    return { ok: false, errorKey: "auth.passwordTooLong" };
  }

  const existing = await db.user.findUnique({ where: { username: normalized } });
  if (existing) {
    return { ok: false, errorKey: "auth.usernameTaken" };
  }

  const orgName =
    options.organizationName?.trim() ||
    defaultOrgName(normalized, options.accountType);
  const homeUser = options.accountType === "home";
  const passwordHash = await hashPassword(password);

  const user = await db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: orgName,
        homeUser,
        active: true,
      },
    });

    const store = await tx.store.create({
      data: {
        clientId: client.id,
        name: defaultStoreName(options.accountType),
        active: true,
      },
    });

    const created = await tx.user.create({
      data: {
        username: normalized,
        passwordHash,
        role: "USER",
        clientRole: "OWNER",
        clientId: client.id,
        storeLinks: {
          create: [{ storeId: store.id }],
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        active: true,
        clientId: true,
        clientRole: true,
      },
    });

    return created;
  });

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    clientId: user.clientId,
  });

  return { ok: true, user, token };
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
      clientRole: user.clientRole,
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

export type { ClientRole };

export { paymentAmount, expiryListVisible } from "@/lib/expiry";
