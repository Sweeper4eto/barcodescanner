import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import { clearMockCookie, setMockSession } from "./helpers/mock-cookies";
import {
  migrateTestDb,
  resetTestDb,
  seedAdmin,
  seedClientWithStore,
  seedUserWithAccess,
  setupTestEnv,
} from "./helpers/db";

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let loginUser: typeof import("../src/lib/auth").loginUser;
let queryDocumentOcrUsage: typeof import("../src/lib/document-ocr-usage").queryDocumentOcrUsage;
let documentOcrUsageDayKey: typeof import("../src/lib/document-ocr-usage").documentOcrUsageDayKey;
let usageGet: (request: Request) => Promise<Response>;

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ loginUser } = await import("../src/lib/auth"));
  ({ queryDocumentOcrUsage, documentOcrUsageDayKey } = await import(
    "../src/lib/document-ocr-usage"
  ));
  ({ GET: usageGet } = await import(
    "../src/app/api/admin/document-ocr-usage/route"
  ));
});

test.beforeEach(async () => {
  clearMockCookie();
  await resetTestDb(db);
  await seedAdmin(db);
});

function sofiaDay(date: Date): string {
  return documentOcrUsageDayKey(date);
}

async function seedScan(input: {
  userId: string;
  username: string;
  storeId: string;
  createdAt: Date;
}) {
  await db.documentOcrScan.create({
    data: {
      userId: input.userId,
      username: input.username,
      storeId: input.storeId,
      createdAt: input.createdAt,
    },
  });
}

test("OCR usage lists the latest scan first and breaks ties by username", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const late = await seedUserWithAccess(db, client.id, store.id, "ocr_late");
  const adam = await seedUserWithAccess(db, client.id, store.id, "ocr_adam");
  const zoe = await seedUserWithAccess(db, client.id, store.id, "ocr_zoe");
  const sameTime = new Date("2026-10-18T06:00:00.000Z");
  await seedScan({
    userId: adam.id,
    username: adam.username,
    storeId: store.id,
    createdAt: sameTime,
  });
  await seedScan({
    userId: zoe.id,
    username: zoe.username,
    storeId: store.id,
    createdAt: sameTime,
  });
  await seedScan({
    userId: late.id,
    username: late.username,
    storeId: store.id,
    createdAt: new Date("2026-10-18T09:00:00.000Z"),
  });

  const today = sofiaDay(new Date("2026-10-18T12:00:00.000Z"));
  const result = await queryDocumentOcrUsage({
    dateFrom: today,
    dateTo: today,
  });
  assert.deepEqual(
    result.rows.map((row) => row.username),
    ["ocr_late", "ocr_adam", "ocr_zoe"],
  );
  assert.equal(result.rows[0]?.scanCount, 1);
  assert.equal(result.totalScans, 3);

  const filtered = await queryDocumentOcrUsage({
    dateFrom: today,
    dateTo: today,
    q: "adam",
  });
  assert.deepEqual(
    filtered.rows.map((row) => row.username),
    ["ocr_adam"],
  );
});

test("admin OCR usage route returns newest first and rejects other users", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const early = await seedUserWithAccess(db, client.id, store.id, "ocr_early");
  const recent = await seedUserWithAccess(db, client.id, store.id, "ocr_recent");
  await seedScan({
    userId: early.id,
    username: early.username,
    storeId: store.id,
    createdAt: new Date("2026-10-18T06:00:00.000Z"),
  });
  await seedScan({
    userId: recent.id,
    username: recent.username,
    storeId: store.id,
    createdAt: new Date("2026-10-18T11:00:00.000Z"),
  });

  const memberLogin = await loginUser("ocr_early", "password123");
  assert.equal(memberLogin.ok, true);
  if (!memberLogin.ok) return;
  await setMockSession(memberLogin.token);
  const denied = await usageGet(
    new Request("http://localhost/api/admin/document-ocr-usage"),
  );
  assert.equal(denied.status, 403);

  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);
  const response = await usageGet(
    new Request(
      "http://localhost/api/admin/document-ocr-usage?dateFrom=2026-10-18&dateTo=2026-10-18",
    ),
  );
  assert.equal(response.status, 200);
  const data = (await response.json()) as { rows: { username: string }[] };
  assert.deepEqual(
    data.rows.map((row) => row.username),
    ["ocr_recent", "ocr_early"],
  );
});

test("an inverted OCR date range returns no rows", async () => {
  const result = await queryDocumentOcrUsage({
    dateFrom: "2026-10-20",
    dateTo: "2026-10-01",
  });
  assert.deepEqual(result.rows, []);
  assert.equal(result.totalScans, 0);
});
