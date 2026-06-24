import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth";
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

  const result = await registerUser(parsed.data.username, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json(
      { error: apiT(request, result.errorKey) },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: result.user,
    message: apiT(request, "auth.registerSuccess"),
  });
}
