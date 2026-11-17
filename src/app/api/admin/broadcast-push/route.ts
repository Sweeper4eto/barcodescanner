import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminResponse } from "@/lib/admin-guard";
import {
  countBroadcastPushAudience,
  sendAdminBroadcastPush,
  type BroadcastAudience,
} from "@/lib/admin-broadcast-push";
import { isPushConfigured } from "@/lib/push";
import { apiT } from "@/i18n";

const audienceSchema = z.enum(["all", "owners", "members"]);

const sendSchema = z.object({
  audience: audienceSchema,
  titleEn: z.string().trim().min(1).max(120),
  titleBg: z.string().trim().min(1).max(120),
  bodyEn: z.string().trim().max(500).default(""),
  bodyBg: z.string().trim().max(500).default(""),
  url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      if (!trimmed) return "/app";
      return trimmed.startsWith("/") ? trimmed : null;
    }),
});

export async function GET(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  const url = new URL(request.url);
  const parsedAudience = audienceSchema.safeParse(
    url.searchParams.get("audience") ?? "all",
  );
  const audience: BroadcastAudience = parsedAudience.success
    ? parsedAudience.data
    : "all";

  const [all, owners, members] = await Promise.all([
    countBroadcastPushAudience("all"),
    countBroadcastPushAudience("owners"),
    countBroadcastPushAudience("members"),
  ]);

  return NextResponse.json({
    pushConfigured: isPushConfigured(),
    counts: { all, owners, members },
    audience,
    matching: audience === "all" ? all : audience === "owners" ? owners : members,
  });
}

export async function POST(request: Request) {
  const admin = await requireAdminResponse(request);
  if (admin instanceof NextResponse) return admin;

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: apiT(request, "admin.broadcastPushNotConfigured") },
      { status: 503 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success || parsed.data.url === null) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const result = await sendAdminBroadcastPush({
    audience: parsed.data.audience,
    titleEn: parsed.data.titleEn,
    titleBg: parsed.data.titleBg,
    bodyEn: parsed.data.bodyEn,
    bodyBg: parsed.data.bodyBg,
    url: parsed.data.url,
  });

  return NextResponse.json({ ok: true, result });
}
