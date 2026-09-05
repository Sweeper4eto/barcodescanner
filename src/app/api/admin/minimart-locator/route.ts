import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import {
  ASL_SOURCE,
  fetchMinimartAslStores,
  isMinimartVisitStatus,
  minimartStatusSchema,
  type MinimartVisitStatus,
} from "@/lib/minimart-locator";

async function requireAdminResponse(request: Request) {
  try {
    return await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.forbidden") },
      { status: 403 },
    );
  }
}

function serialize(store: {
  id: string;
  externalId: string;
  title: string;
  street: string;
  city: string;
  postalCode: string | null;
  lat: number;
  lng: number;
  status: string;
  comment: string;
  syncedAt: Date;
}) {
  const status: MinimartVisitStatus = isMinimartVisitStatus(store.status)
    ? store.status
    : "NOT_VISITED";
  return {
    ...store,
    status,
    syncedAt: store.syncedAt.toISOString(),
    manual: store.externalId.startsWith("manual:"),
  };
}

export async function GET(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const statusParam = (url.searchParams.get("status") ?? "").trim();
  const statusFilter =
    statusParam && isMinimartVisitStatus(statusParam) ? statusParam : null;

  const stores = await db.minimartLocatorStore.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : null),
      ...(q
        ? {
            OR: [
              { city: { contains: q } },
              { street: { contains: q } },
              { title: { contains: q } },
              { comment: { contains: q } },
            ],
          }
        : null),
    },
    orderBy: [{ city: "asc" }, { street: "asc" }],
  });

  const statusCounts = {
    NOT_VISITED: 0,
    ACCEPTED: 0,
    THINKING: 0,
    REJECTED: 0,
  };
  for (const store of stores) {
    if (isMinimartVisitStatus(store.status)) {
      statusCounts[store.status] += 1;
    } else {
      statusCounts.NOT_VISITED += 1;
    }
  }

  return NextResponse.json({
    source: ASL_SOURCE,
    count: stores.length,
    statusCounts,
    stores: stores.map(serialize),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: minimartStatusSchema.optional(),
  comment: z.string().max(4000).optional(),
  title: z.string().min(1).max(200).optional(),
  street: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  postalCode: z.string().max(32).nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function PATCH(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  const { id, ...rest } = parsed.data;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }

  try {
    const store = await db.minimartLocatorStore.update({
      where: { id },
      data,
    });
    return NextResponse.json({ store: serialize(store) });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }
}

const createSchema = z.object({
  action: z.literal("create"),
  title: z.string().min(1).max(200).default("Store"),
  street: z.string().max(300).default(""),
  city: z.string().min(1).max(120),
  postalCode: z.string().max(32).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: minimartStatusSchema.optional().default("NOT_VISITED"),
  comment: z.string().max(4000).optional().default(""),
});

const syncSchema = z.object({
  action: z.literal("sync").optional(),
});

/** Create a manual pin, or sync public Minimart stores. */
export async function POST(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const json = await request.json().catch(() => ({}));

  if (json && typeof json === "object" && (json as { action?: string }).action === "create") {
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const now = new Date();
    const externalId = `manual:${crypto.randomUUID()}`;
    const store = await db.minimartLocatorStore.create({
      data: {
        externalId,
        title: parsed.data.title.trim() || "Store",
        street: parsed.data.street.trim(),
        city: parsed.data.city.trim(),
        postalCode: parsed.data.postalCode?.trim() || null,
        country: "Bulgaria",
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        status: parsed.data.status,
        comment: parsed.data.comment,
        syncedAt: now,
      },
    });
    return NextResponse.json({ store: serialize(store) }, { status: 201 });
  }

  const syncParsed = syncSchema.safeParse(json ?? {});
  if (!syncParsed.success) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }

  try {
    const remote = await fetchMinimartAslStores();
    const now = new Date();
    let upserted = 0;

    for (const row of remote) {
      await db.minimartLocatorStore.upsert({
        where: { externalId: row.externalId },
        create: {
          ...row,
          status: "NOT_VISITED",
          comment: "",
          syncedAt: now,
        },
        update: {
          title: row.title,
          street: row.street,
          city: row.city,
          postalCode: row.postalCode,
          country: row.country,
          lat: row.lat,
          lng: row.lng,
          phone: row.phone,
          website: row.website,
          openHoursJson: row.openHoursJson,
          slug: row.slug,
          syncedAt: now,
        },
      });
      upserted += 1;
    }

    const count = await db.minimartLocatorStore.count();
    const acceptedCount = await db.minimartLocatorStore.count({
      where: { status: "ACCEPTED" },
    });

    return NextResponse.json({
      source: ASL_SOURCE,
      upserted,
      count,
      acceptedCount,
    });
  } catch (error) {
    console.error("minimart locator sync failed", error);
    return NextResponse.json(
      { error: apiT(request, "errors.networkError") },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: apiT(request, "errors.missingId") },
      { status: 400 },
    );
  }

  try {
    await db.minimartLocatorStore.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }
}
