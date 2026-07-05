import test from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  clearMockCookie,
  setMockSession,
} from "./helpers/mock-cookies";
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
let registerPost: (request: Request) => Promise<Response>;
let loginPost: (request: Request) => Promise<Response>;
let productsGet: (request: Request) => Promise<Response>;
let productsPost: (request: Request) => Promise<Response>;
let inventoryPost: (request: Request) => Promise<Response>;
let inventoryGet: (request: Request) => Promise<Response>;
let inventoryPatch: (request: Request) => Promise<Response>;
let cronPost: (request: Request) => Promise<Response>;
let clientsGet: (request: Request) => Promise<Response>;
let clientsPost: (request: Request) => Promise<Response>;
let usersPatch: (request: Request) => Promise<Response>;
let paymentsPost: (request: Request) => Promise<Response>;
let calendarGet: (request: Request) => Promise<Response>;
let adminProductsPatch: (request: Request) => Promise<Response>;

async function jsonRequest(
  handler: (request: Request) => Promise<Response>,
  init: RequestInit & { url?: string } = {},
) {
  const response = await handler(
    new Request(init.url ?? "http://localhost/api", init),
  );
  const data = await response.json();
  return { response, data };
}

test.before(async () => {
  ({ db } = await import("../src/lib/db"));
  ({ loginUser } = await import("../src/lib/auth"));
  ({ POST: registerPost } = await import("../src/app/api/auth/register/route"));
  ({ POST: loginPost } = await import("../src/app/api/auth/login/route"));
  ({ GET: productsGet, POST: productsPost } = await import(
    "../src/app/api/products/route"
  ));
  ({ POST: inventoryPost, GET: inventoryGet, PATCH: inventoryPatch } =
    await import("../src/app/api/inventory/route"));
  ({ POST: cronPost } = await import("../src/app/api/cron/purge-inventory/route"));
  ({ GET: clientsGet, POST: clientsPost } = await import(
    "../src/app/api/admin/clients/route"
  ));
  ({ PATCH: usersPatch } = await import("../src/app/api/admin/users/route"));
  ({ POST: paymentsPost } = await import("../src/app/api/admin/payments/route"));
  ({ GET: calendarGet } = await import(
    "../src/app/api/admin/payments/calendar/route"
  ));
  ({ PATCH: adminProductsPatch } = await import(
    "../src/app/api/admin/products/route"
  ));
});

test.beforeEach(async () => {
  clearMockCookie();
  await resetTestDb(db);
  await seedAdmin(db);
});

test("POST /api/auth/register creates user and returns English message", async () => {
  const { response, data } = await jsonRequest(registerPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "newbie", password: "password123" }),
  });

  assert.equal(response.status, 200);
  assert.equal(data.user.username, "newbie");
  assert.match(data.message, /administrator/i);
});

test("POST /api/auth/login sets session for admin", async () => {
  const { response, data } = await jsonRequest(loginPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });

  assert.equal(response.status, 200);
  assert.equal(data.user.role, "ADMIN");
});

test("products API requires authentication", async () => {
  const { response } = await jsonRequest(productsGet, {
    url: "http://localhost/api/products?barcode=123",
  });
  assert.equal(response.status, 401);
});

test("product lookup matches UPC-A and EAN-13 barcodes", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "400229340110", name: "UPC Product" }),
  });
  assert.equal(createProduct.response.status, 201);
  assert.equal(createProduct.data.product.barcode, "0400229340110");

  const lookupUpc = await jsonRequest(productsGet, {
    url: "http://localhost/api/products?barcode=400229340110",
  });
  assert.equal(lookupUpc.response.status, 200);
  assert.equal(lookupUpc.data.product?.name, "UPC Product");
});

test("full inventory flow via APIs", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "999", name: "Yogurt" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 14);

  const createEntry = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "999",
      productId: createProduct.data.product.id,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(createEntry.response.status, 201);

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.entries.length, 1);

  const remove = await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId: list.data.entries[0].id,
      storeId: store.id,
    }),
  });
  assert.equal(remove.response.status, 200);

  const afterRemove = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(afterRemove.data.entries.length, 0);
});

test("POST /api/inventory merges quantity for active same product and expiry day", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "555", name: "Bread" }),
  });
  assert.equal(createProduct.response.status, 201);

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 14);
  expiry.setUTCHours(0, 0, 0, 0);

  const first = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "555",
      productId: createProduct.data.product.id,
      quantity: 2,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.data.merged, false);
  assert.equal(first.data.entry.quantity, 2);

  const second = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "555",
      productId: createProduct.data.product.id,
      quantity: 3,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.data.merged, true);
  assert.equal(second.data.entry.id, first.data.entry.id);
  assert.equal(second.data.entry.quantity, 5);

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}`,
  });
  assert.equal(list.data.entries.length, 1);
  assert.equal(list.data.entries[0].quantity, 5);
});

test("PATCH /api/admin/products updates barcode on all inventory entries", async () => {
  const client = await seedClientWithStore(db);
  const storeA = client.stores[0];
  const storeB = await db.store.create({
    data: { clientId: client.id, name: "Store B" },
  });
  const user = await seedUserWithAccess(db, client.id, storeA.id);
  await db.userStore.create({
    data: { userId: user.id, storeId: storeB.id },
  });

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "111222", name: "Milk" }),
  });
  assert.equal(createProduct.response.status, 201);
  const productId = createProduct.data.product.id as string;

  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 10);
  expiry.setUTCHours(0, 0, 0, 0);

  for (const storeId of [storeA.id, storeB.id]) {
    const created = await jsonRequest(inventoryPost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        barcode: "111222",
        productId,
        quantity: 1,
        expiryDate: expiry.toISOString(),
      }),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.entry.barcode, "111222");
  }

  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const updated = await jsonRequest(adminProductsPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: productId,
      barcode: "999888",
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.data.product.barcode, "999888");

  const entries = await db.inventoryEntry.findMany({ where: { productId } });
  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.barcode === "999888"));

  await setMockSession(login.token);

  for (const storeId of [storeA.id, storeB.id]) {
    const list = await jsonRequest(inventoryGet, {
      url: `http://localhost/api/inventory?storeId=${storeId}`,
    });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.entries.length, 1);
    assert.equal(list.data.entries[0].barcode, "999888");
  }

  const search = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${storeA.id}&q=999888`,
  });
  assert.equal(search.data.entries.length, 1);
});

test("POST /api/inventory does not merge removed entries with same expiry", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const createProduct = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "777", name: "Cheese" }),
  });

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 10);

  const created = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "777",
      productId: createProduct.data.product.id,
      quantity: 1,
      expiryDate: expiry.toISOString(),
    }),
  });

  await jsonRequest(inventoryPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entryId: created.data.entry.id,
      storeId: store.id,
    }),
  });

  const recreated = await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "777",
      productId: createProduct.data.product.id,
      quantity: 4,
      expiryDate: expiry.toISOString(),
    }),
  });
  assert.equal(recreated.response.status, 201);
  assert.equal(recreated.data.merged, false);
  assert.notEqual(recreated.data.entry.id, created.data.entry.id);
  assert.equal(recreated.data.entry.quantity, 4);
});

test("inventory list filters expiry window, search, and pagination", async () => {
  const client = await seedClientWithStore(db);
  const store = client.stores[0];
  const user = await seedUserWithAccess(db, client.id, store.id);

  const login = await loginUser(user.username, "password123");
  assert.equal(login.ok, true);
  if (!login.ok) return;
  await setMockSession(login.token);

  const yogurt = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "111", name: "Yogurt" }),
  });
  const milk = await jsonRequest(productsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: "222", name: "Milk" }),
  });

  const nearExpiry = new Date();
  nearExpiry.setDate(nearExpiry.getDate() + 10);
  const farExpiry = new Date();
  farExpiry.setDate(farExpiry.getDate() + 60);

  for (let index = 0; index < 3; index += 1) {
    await jsonRequest(inventoryPost, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: store.id,
        barcode: "111",
        productId: yogurt.data.product.id,
        quantity: 1,
        expiryDate: nearExpiry.toISOString(),
      }),
    });
  }

  await jsonRequest(inventoryPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: store.id,
      barcode: "222",
      productId: milk.data.product.id,
      quantity: 1,
      expiryDate: farExpiry.toISOString(),
    }),
  });

  const list = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&page=1&limit=2`,
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.entries.length, 1);
  assert.equal(list.data.entries[0].quantity, 3);
  assert.equal(list.data.pagination.total, 1);
  assert.equal(list.data.pagination.totalPages, 1);

  const search = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=Milk`,
  });
  assert.equal(search.response.status, 200);
  assert.equal(search.data.entries.length, 0);

  const barcodeSearch = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&q=111`,
  });
  assert.equal(barcodeSearch.data.entries.length, 1);
  assert.equal(barcodeSearch.data.entries[0].quantity, 3);

  const wideWindow = await jsonRequest(inventoryGet, {
    url: `http://localhost/api/inventory?storeId=${store.id}&withinDays=90`,
  });
  assert.equal(wideWindow.response.status, 200);
  assert.equal(wideWindow.data.entries.length, 2);
});

test("admin clients and user assignment APIs", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const createClient = await jsonRequest(clientsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Acme",
      monthlyFeePerStore: 15,
    }),
  });
  assert.equal(createClient.response.status, 201);

  await registerPost(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "staff", password: "password123" }),
    }),
  );

  const registeredUser = await db.user.findUnique({ where: { username: "staff" } });
  assert.ok(registeredUser);

  const client = createClient.data.client;
  const store = await db.store.create({
    data: { clientId: client.id, name: "Downtown" },
  });

  const assign = await jsonRequest(usersPatch, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: registeredUser!.id,
      clientId: client.id,
      storeIds: [store.id],
      active: true,
    }),
  });
  assert.equal(assign.response.status, 200);

  const list = await jsonRequest(clientsGet, {
    url: "http://localhost/api/admin/clients",
  });
  assert.equal(list.response.status, 200);
  assert.equal(list.data.clients.length, 1);
});

test("payments calendar and mark paid APIs", async () => {
  const adminLogin = await loginUser("admin", "admin123");
  assert.equal(adminLogin.ok, true);
  if (!adminLogin.ok) return;
  await setMockSession(adminLogin.token);

  const client = await seedClientWithStore(db);
  const now = new Date();

  const calendar = await jsonRequest(calendarGet, {
    url: `http://localhost/api/admin/payments/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}&calendar=1`,
  });
  assert.equal(calendar.response.status, 200);
  assert.equal(calendar.data.rows.length, 1);
  assert.equal(calendar.data.rows[0].paid, false);

  const markPaid = await jsonRequest(paymentsPost, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: client.id,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      discount: 0,
    }),
  });
  assert.equal(markPaid.response.status, 201);
  assert.equal(markPaid.data.payment.amountPaid, 10);
});

test("cron purge endpoint requires secret", async () => {
  const forbidden = await jsonRequest(cronPost, { method: "POST" });
  assert.equal(forbidden.response.status, 403);

  const allowed = await jsonRequest(cronPost, {
    method: "POST",
    headers: { "x-cron-secret": "test-cron-secret" },
  });
  assert.equal(allowed.response.status, 200);
  assert.equal(typeof allowed.data.purged, "number");
});

test.after(async () => {
  await db.$disconnect();
});
