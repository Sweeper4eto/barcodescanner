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
let registerUser: typeof import("../src/lib/auth").registerUser;
let loginUser: typeof import("../src/lib/auth").loginUser;
let purgeExpiredInventory: typeof import("../src/lib/inventory-purge").purgeExpiredInventory;

const homeOpts = { accountType: "home" as const };

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ registerUser, loginUser } = await import("../src/lib/auth"));
  ({ purgeExpiredInventory } = await import("../src/lib/inventory-purge"));
});

test.beforeEach(async () => {
  await resetTestDb(db);
  await seedAdmin(db);
});

test("registerUser validates username and password length", async () => {
  const shortName = await registerUser("ab", "password123", homeOpts);
  assert.equal(shortName.ok, false);
  if (!shortName.ok) assert.equal(shortName.errorKey, "auth.usernameTooShort");

  const shortPass = await registerUser("validuser", "12345", homeOpts);
  assert.equal(shortPass.ok, false);
  if (!shortPass.ok) assert.equal(shortPass.errorKey, "auth.passwordTooShort");
});

test("registerUser rejects duplicate usernames", async () => {
  const first = await registerUser("duplicate", "password123", homeOpts);
  assert.equal(first.ok, true);

  const second = await registerUser("Duplicate", "password123", homeOpts);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.errorKey, "auth.usernameTaken");
});

test("registerUser creates client, store, owner role and can login", async () => {
  const registered = await registerUser("newuser", "password123", {
    accountType: "retail",
    organizationName: "Acme Market",
  });
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  assert.ok(registered.user.clientId);
  assert.equal(registered.user.clientRole, "OWNER");
  assert.ok(registered.token.length > 0);

  const client = await db.client.findUniqueOrThrow({
    where: { id: registered.user.clientId! },
  });
  assert.equal(client.name, "Acme Market");
  assert.equal(client.homeUser, false);

  const stores = await db.store.findMany({
    where: { clientId: client.id },
  });
  assert.equal(stores.length, 1);

  const login = await loginUser("newuser", "password123");
  assert.equal(login.ok, true);
});

test("registerUser home account sets homeUser flag", async () => {
  const registered = await registerUser("homeuser", "password123", homeOpts);
  assert.equal(registered.ok, true);
  if (!registered.ok) return;

  const client = await db.client.findUniqueOrThrow({
    where: { id: registered.user.clientId! },
  });
  assert.equal(client.homeUser, true);
});

test("loginUser succeeds for assigned user with store access", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const result = await loginUser(user.username, "password123");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.username, user.username);
    assert.ok(result.token.length > 0);
  }
});

test("loginUser rejects invalid credentials", async () => {
  const result = await loginUser("nobody", "wrong");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errorKey, "auth.invalidCredentials");
});

test("purgeExpiredInventory soft-deletes very old expired entries", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const product = await db.product.create({
    data: { barcode: "123", name: "Milk" },
  });

  const oldExpiry = new Date();
  oldExpiry.setMonth(oldExpiry.getMonth() - 7);

  await db.inventoryEntry.create({
    data: {
      storeId: store.id,
      productId: product.id,
      barcode: product.barcode,
      quantity: 1,
      expiryDate: oldExpiry,
    },
  });

  const purged = await purgeExpiredInventory();
  assert.equal(purged, 1);

  const remaining = await db.inventoryEntry.findMany({
    where: { deletedAt: null },
  });
  assert.equal(remaining.length, 0);
});

test.after(async () => {
  await db.$disconnect();
});
