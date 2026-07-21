import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  migrateTestDb,
  resetTestDb,
  seedAdmin,
  seedClientWithStore,
  seedOwnerWithAccess,
  seedUserWithAccess,
  setupTestEnv,
} from "./helpers/db";
import { clearMockCookie, jsonRequest, setMockSession } from "./helpers/mock-cookies";

setupTestEnv();
migrateTestDb();

let db: PrismaClient;
let loginUser: typeof import("../src/lib/auth").loginUser;
let favouritesGet: (request: Request) => Promise<Response>;
let favouritesPost: (request: Request) => Promise<Response>;
let favouritesDelete: (request: Request) => Promise<Response>;
let teamGet: (request: Request) => Promise<Response>;
let teamPost: (request: Request) => Promise<Response>;
let teamPatch: (request: Request) => Promise<Response>;

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ loginUser } = await import("../src/lib/auth"));
  ({
    GET: favouritesGet,
    POST: favouritesPost,
    DELETE: favouritesDelete,
  } = await import("../src/app/api/favourites/route"));
  ({
    GET: teamGet,
    POST: teamPost,
    PATCH: teamPatch,
  } = await import("../src/app/api/team/users/route"));
});

test.beforeEach(async () => {
  clearMockCookie();
  await resetTestDb(db);
  await seedAdmin(db);
});

test("favourites API requires home-user store access", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id, "retail-worker");
  const login = await loginUser(user.username, "password123");
  assert.ok(login.ok);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response } = await jsonRequest(favouritesGet, {
    url: `http://localhost/api/favourites?storeId=${store.id}`,
  });
  assert.equal(response.status, 403);
});

test("favourites API upsert and list for home users", async () => {
  const client = await seedClientWithStore(db);
  await db.client.update({
    where: { id: client.id },
    data: { homeUser: true },
  });
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id, "home-worker");
  const product = await db.product.create({
    data: { barcode: "fav-1", name: "Favourite Milk" },
  });
  const login = await loginUser(user.username, "password123");
  assert.ok(login.ok);
  if (!login.ok) return;
  await setMockSession(login.token);

  const created = await jsonRequest(favouritesPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: store.id, productId: product.id }),
  });
  assert.equal(created.response.status, 201);

  const listed = await jsonRequest(favouritesGet, {
    url: `http://localhost/api/favourites?storeId=${store.id}`,
  });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.data.productIds.length, 1);
  assert.equal(listed.data.favourites[0].product.id, product.id);

  const removed = await jsonRequest(favouritesDelete, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: store.id, productId: product.id }),
  });
  assert.equal(removed.response.status, 200);
});

test("team owner can create and deactivate members", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const owner = await seedOwnerWithAccess(db, client.id, store.id, "boss");
  const login = await loginUser(owner.username, "password123");
  assert.ok(login.ok);
  if (!login.ok) return;
  await setMockSession(login.token);

  const created = await jsonRequest(teamPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "clerk1",
      password: "password123",
      storeIds: [store.id],
    }),
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.data.user.username, "clerk1");
  assert.equal(created.data.user.clientRole, "MEMBER");

  const listed = await jsonRequest(teamGet, { method: "GET" });
  assert.equal(listed.response.status, 200);
  assert.ok(
    listed.data.users.some((u: { username: string }) => u.username === "clerk1"),
  );

  const deactivated = await jsonRequest(teamPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: created.data.user.id, active: false }),
  });
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.data.user.active, false);
});

test("team member cannot manage users", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const member = await seedUserWithAccess(db, client.id, store.id, "clerk");
  const login = await loginUser(member.username, "password123");
  assert.ok(login.ok);
  if (!login.ok) return;
  await setMockSession(login.token);

  const { response } = await jsonRequest(teamGet, { method: "GET" });
  assert.equal(response.status, 403);
});

test.after(async () => {
  await db.$disconnect();
});
