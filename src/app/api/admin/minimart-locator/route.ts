import { requireAdminResponse } from "@/lib/admin-guard";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiT } from "@/i18n";
import {
  ASL_SOURCE,
  fetchMinimartAslStores,
  isMinimartVisitStatus,
  minimartStatusSchema,
  type MinimartVisitStatus,
} from "@/lib/minimart-locator";
import {
  OSM_ATTRIBUTION,
  fetchOsmBulgariaRetailStores,
} from "@/lib/osm-locator";
import { normalizeSearchText, searchTextIncludes } from "@/lib/search-text";

/** Geofabrik PBF download (~180MB) + parse can take several minutes on first import. */
export const maxDuration = 300;

const clientInclude = {
  client: { select: { id: true, name: true, homeUser: true } },
} as const;

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
  clientId: string | null;
  syncedAt: Date;
  client?: { id: string; name: string; homeUser: boolean } | null;
}) {
  const status: MinimartVisitStatus = isMinimartVisitStatus(store.status)
    ? store.status
    : "NOT_VISITED";
  return {
    id: store.id,
    externalId: store.externalId,
    title: store.title,
    street: store.street,
    city: store.city,
    postalCode: store.postalCode,
    lat: store.lat,
    lng: store.lng,
    status,
    comment: store.comment,
    clientId: store.clientId,
    clientName: store.client?.name ?? null,
    clientHomeUser: store.client?.homeUser ?? null,
    syncedAt: store.syncedAt.toISOString(),
    manual: store.externalId.startsWith("manual:"),
  };
}

async function resolveClientId(
  request: Request,
  clientId: string | null | undefined,
): Promise<string | null | undefined | NextResponse> {
  if (clientId === undefined) return undefined;
  if (clientId === null || clientId === "") return null;
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, homeUser: true },
  });
  if (!client) {
    return NextResponse.json(
      { error: apiT(request, "errors.entryNotFound") },
      { status: 404 },
    );
  }
  if (client.homeUser) {
    return NextResponse.json(
      { error: apiT(request, "errors.invalidData") },
      { status: 400 },
    );
  }
  return client.id;
}

export async function GET(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const q = normalizeSearchText(url.searchParams.get("q") ?? "");
  const statusParam = (url.searchParams.get("status") ?? "").trim();
  const statusFilter =
    statusParam && isMinimartVisitStatus(statusParam) ? statusParam : null;

  const storesRaw = await db.minimartLocatorStore.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : null),
    },
    include: clientInclude,
    orderBy: [{ city: "asc" }, { street: "asc" }],
  });

  // JS match: SQLite LIKE is ASCII-only case-insensitive (Bulgarian needs Unicode fold).
  const stores = !q
    ? storesRaw
    : storesRaw.filter(
        (store) =>
          searchTextIncludes(store.city, q) ||
          searchTextIncludes(store.street, q) ||
          searchTextIncludes(store.title, q) ||
          searchTextIncludes(store.comment, q) ||
          searchTextIncludes(store.client?.name, q),
      );

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
  clientId: z.string().nullable().optional(),
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

  const { id, clientId: clientIdRaw, ...rest } = parsed.data;
  const clientId = await resolveClientId(request, clientIdRaw);
  if (clientId instanceof NextResponse) return clientId;

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) data[key] = value;
  }
  if (clientId !== undefined) data.clientId = clientId;

  try {
    const store = await db.minimartLocatorStore.update({
      where: { id },
      data,
      include: clientInclude,
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
  clientId: z.string().nullable().optional(),
});

const syncSchema = z.object({
  action: z.enum(["sync", "syncOsm"]).optional(),
});

async function upsertLocatorRows(
  rows: Array<{
    externalId: string;
    title: string;
    street: string;
    city: string;
    postalCode: string | null;
    country: string | null;
    lat: number;
    lng: number;
    phone: string | null;
    website: string | null;
    openHoursJson: string | null;
    slug: string | null;
  }>,
) {
  const now = new Date();
  const batchSize = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.$transaction(
      batch.map((row) =>
        db.minimartLocatorStore.upsert({
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
            // Keep status, comment, and clientId untouched on sync.
          },
        }),
      ),
    );
    upserted += batch.length;
  }
  const count = await db.minimartLocatorStore.count();
  const acceptedCount = await db.minimartLocatorStore.count({
    where: { status: "ACCEPTED" },
  });
  return { upserted, count, acceptedCount };
}

/** Create a manual pin, sync Minimart, or import OSM Bulgaria retail POIs (Geofabrik PBF). */
export async function POST(request: Request) {
  const session = await requireAdminResponse(request);
  if (session instanceof NextResponse) return session;

  const json = await request.json().catch(() => ({}));
  const action =
    json && typeof json === "object"
      ? (json as { action?: string }).action
      : undefined;

  if (action === "create") {
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: apiT(request, "errors.invalidData") },
        { status: 400 },
      );
    }

    const clientId = await resolveClientId(request, parsed.data.clientId);
    if (clientId instanceof NextResponse) return clientId;

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
        clientId: clientId ?? null,
        syncedAt: now,
      },
      include: clientInclude,
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

  if (action === "syncOsm") {
    try {
      const remote = await fetchOsmBulgariaRetailStores();
      const result = await upsertLocatorRows(remote);
      return NextResponse.json({
        source: OSM_ATTRIBUTION,
        ...result,
      });
    } catch (error) {
      console.error("osm locator import failed", error);
      return NextResponse.json(
        { error: apiT(request, "admin.minimartOsmImportFailed") },
        { status: 502 },
      );
    }
  }

  try {
    const remote = await fetchMinimartAslStores();
    const result = await upsertLocatorRows(remote);
    return NextResponse.json({
      source: ASL_SOURCE,
      ...result,
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
