import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
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
let canViewUpload: typeof import("../src/lib/upload-access").canViewUpload;
let saveDataUrl: typeof import("../src/lib/upload").saveDataUrl;
let deleteLocalUpload: typeof import("../src/lib/upload").deleteLocalUpload;

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ canViewUpload } = await import("../src/lib/upload-access"));
  ({ saveDataUrl, deleteLocalUpload } = await import("../src/lib/upload"));
});

test.beforeEach(async () => {
  await resetTestDb(db);
  await seedAdmin(db);
});

const tinyJpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64")}`;

test("a catalog photo is visible to any logged-in user", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const member = await seedUserWithAccess(db, client.id, store.id, "photo_member");
  const otherClient = await seedClientWithStore(db);
  const otherStore = otherClient.stores[0]!;
  const stranger = await seedUserWithAccess(
    db,
    otherClient.id,
    otherStore.id,
    "photo_stranger",
  );
  const path = await saveDataUrl(tinyJpeg, member.id);
  await db.product.create({
    data: { barcode: `photo-${Date.now()}`, name: "Milk", imagePath: path },
  });
  const filename = path.slice("/uploads/".length);

  assert.equal(await canViewUpload(member.id, "USER", filename), true);
  assert.equal(await canViewUpload(stranger.id, "USER", filename), true);
  await deleteLocalUpload(path);
});

test("a store expiry photo is limited to that store and admins", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const member = await seedUserWithAccess(db, client.id, store.id, "expiry_member");
  const otherClient = await seedClientWithStore(db);
  const stranger = await seedUserWithAccess(
    db,
    otherClient.id,
    otherClient.stores[0]!.id,
    "expiry_stranger",
  );
  const admin = await db.user.findUniqueOrThrow({ where: { username: "admin" } });
  const path = await saveDataUrl(tinyJpeg, member.id);
  const product = await db.product.create({
    data: { barcode: `expiry-${Date.now()}`, name: "Yogurt" },
  });
  await db.inventoryEntry.create({
    data: {
      storeId: store.id,
      productId: product.id,
      barcode: product.barcode,
      imagePath: path,
      quantity: 1,
      expiryDate: new Date("2026-12-01T00:00:00.000Z"),
    },
  });
  const filename = path.slice("/uploads/".length);

  assert.equal(await canViewUpload(member.id, "USER", filename), true);
  assert.equal(await canViewUpload(stranger.id, "USER", filename), false);
  assert.equal(await canViewUpload(admin.id, "ADMIN", filename), true);
  await deleteLocalUpload(path);
});

test("a photo still on the camera screen is visible only to the person who took it", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0]!;
  const owner = await seedUserWithAccess(db, client.id, store.id, "cam_owner");
  const other = await seedUserWithAccess(db, client.id, store.id, "cam_other");
  const path = await saveDataUrl(tinyJpeg, owner.id);
  const filename = path.slice("/uploads/".length);

  assert.equal(await canViewUpload(owner.id, "USER", filename), true);
  assert.equal(await canViewUpload(other.id, "USER", filename), false);
  await deleteLocalUpload(path);
});
