import { NextResponse } from "next/server";
import { z } from "zod";
import { loginUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/session";
import { apiT } from "@/i18n";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const result = await loginUser(parsed.data.username, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      { error: apiT(request, result.errorKey), code: result.code },
      { status: result.code === "NO_CLIENT" ? 403 : 401 },
    );
  }

  await setSessionCookie(result.token);
  return NextResponse.json({ user: result.user });
}
