import { NextResponse } from "next/server";
import { z } from "zod";
import { describeClientDevice, getClientIp } from "@/lib/audit-log";
import { reportRegisterInterest } from "@/lib/registration-interest-alert";

const bodySchema = z.object({
  event: z.enum(["open", "fill"]),
  fields: z
    .object({
      organizationName: z.string().max(120).optional(),
      username: z.string().max(40).optional(),
      email: z.string().max(200).optional(),
      registrationCodeEntered: z.boolean().optional(),
    })
    .optional(),
});

/** Soft per-IP throttle for beacon spam (separate from login lock). */
const recentHits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 20;

function allowBeacon(ip: string): boolean {
  const now = Date.now();
  const key = ip.trim() || "unknown";
  const hits = (recentHits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_HITS) {
    recentHits.set(key, hits);
    return false;
  }
  hits.push(now);
  recentHits.set(key, hits);
  if (recentHits.size > 2000) {
    for (const [k, times] of recentHits) {
      const kept = times.filter((t) => now - t < WINDOW_MS);
      if (kept.length === 0) recentHits.delete(k);
      else recentHits.set(k, kept);
    }
  }
  return true;
}

/**
 * Public beacon from the Register page.
 * Never accepts or stores passwords / registration code digits.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!allowBeacon(ip)) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const device = describeClientDevice(request);
  const result = await reportRegisterInterest({
    event: parsed.data.event,
    ip,
    device,
    fields: parsed.data.fields,
  });

  return NextResponse.json({ ok: true, created: result.created });
}
