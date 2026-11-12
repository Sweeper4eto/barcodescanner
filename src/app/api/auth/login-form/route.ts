import { NextResponse } from "next/server";
import { auditAuthLogin, auditAuthLoginFailed } from "@/lib/audit-details";
import {
  getClientIp,
  logAuditEvent,
  logFailedLoginAttempt,
} from "@/lib/audit-log";
import { loginUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createLoginTicket } from "@/lib/login-tickets";
import {
  clearLoginFailures,
  getLoginLockRemainingMs,
  recordLoginFailure,
} from "@/lib/login-rate-limit";
import { applySessionCookie } from "@/lib/session";
import { publicUrl } from "@/lib/request-origin";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(publicUrl(request, path), 303);
}

/**
 * Form POST login → set cookies → 303 to /auth/establish?k=… (opaque ticket).
 * Establish completes the session without putting a JWT in any URL.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const username = String(form?.get("username") ?? "").trim();
    const password = String(form?.get("password") ?? "");

    if (!username || !password) {
      console.warn("[login-form] empty fields", {
        hasUser: Boolean(username),
        passLen: password.length,
      });
      await logFailedLoginAttempt(
        request,
        username,
        auditAuthLoginFailed({ reason: "empty credentials" }),
      );
      return redirectTo(request, "/login?error=credentials");
    }

    const ip = getClientIp(request);
    const remaining = getLoginLockRemainingMs(ip, username);
    if (remaining > 0) {
      await logFailedLoginAttempt(
        request,
        username,
        auditAuthLoginFailed({
          reason: "locked",
          typedUsername: username,
        }),
      );
      return redirectTo(request, "/login?error=locked");
    }

    const result = await loginUser(username, password);
    if (!result.ok) {
      console.warn(
        "[login-form] rejected",
        username,
        result.errorKey,
        "passLen=",
        password.length,
      );
      const lockedFor = recordLoginFailure(ip, username);
      const reason =
        lockedFor > 0
          ? "locked after failures"
          : result.code === "NO_CLIENT"
            ? "no client"
            : result.errorKey === "auth.accountDeactivated"
              ? "account deactivated"
              : "invalid credentials";
      await logFailedLoginAttempt(
        request,
        username,
        auditAuthLoginFailed({ reason, typedUsername: username }),
      );
      const code =
        lockedFor > 0
          ? "locked"
          : result.code === "NO_CLIENT"
            ? "no-client"
            : "credentials";
      return redirectTo(request, `/login?error=${code}`);
    }

    clearLoginFailures(ip, username);
    const clientName =
      result.user.clientId
        ? (
            await db.client.findUnique({
              where: { id: result.user.clientId },
              select: { name: true },
            })
          )?.name
        : null;
    await logAuditEvent(
      request,
      result.user,
      "login",
      auditAuthLogin(result.user.role, clientName),
    );

    const nextPath = result.user.mustChangePassword
      ? "/change-password"
      : result.user.role === "ADMIN"
        ? "/admin"
        : "/app";

    const ticket = createLoginTicket(result.token);
    const target = `/auth/establish?k=${encodeURIComponent(ticket)}&next=${encodeURIComponent(nextPath)}`;
    console.info("[login-form] ok", username, "→", nextPath);
    const response = redirectTo(request, target);
    applySessionCookie(response, result.token, request);
    return response;
  } catch (error) {
    console.error("[login-form]", error);
    return redirectTo(request, "/login?error=credentials");
  }
}
