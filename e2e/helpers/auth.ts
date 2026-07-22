import { request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";

async function createAdminApiContext(baseURL: string): Promise<APIRequestContext> {
  const context = await playwrightRequest.newContext({ baseURL });
  const response = await context.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  if (!response.ok()) {
    await context.dispose();
    throw new Error(`Admin login failed: ${await response.text()}`);
  }
  return context;
}

export async function loginInBrowser(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  const result = await page.evaluate(
    async ({ user, pass }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const body = await response.json();
      return { ok: response.ok, body };
    },
    { user: username, pass: password },
  );

  if (!result.ok) {
    throw new Error(`Login failed: ${JSON.stringify(result.body)}`);
  }

  const destination = result.body.user.role === "ADMIN" ? "/admin" : "/app";
  await page.goto(destination);
}

export async function withAdminApi<T>(
  baseURL: string,
  run: (api: APIRequestContext) => Promise<T>,
): Promise<T> {
  const api = await createAdminApiContext(baseURL);
  try {
    return await run(api);
  } finally {
    await api.dispose();
  }
}

export async function createClientViaApi(
  request: APIRequestContext,
  name: string,
  monthlyFeePerStore = 20,
) {
  const response = await request.post("/api/admin/clients", {
    data: { name, monthlyFeePerStore },
  });
  if (!response.ok()) {
    throw new Error(`Create client failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.client as { id: string; name: string };
}

export async function createStoreViaApi(
  request: APIRequestContext,
  clientId: string,
  name: string,
) {
  const response = await request.post("/api/admin/stores", {
    data: { clientId, name },
  });
  if (!response.ok()) {
    throw new Error(`Create store failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.store as { id: string; name: string };
}

export async function registerUserViaApi(
  request: APIRequestContext,
  username: string,
  password = "password123",
) {
  const response = await request.post("/api/auth/register", {
    data: { username, password, accountType: "home" },
  });
  if (!response.ok()) {
    throw new Error(`Register failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.user as { id: string; username: string };
}

export async function assignUserViaApi(
  request: APIRequestContext,
  userId: string,
  clientId: string,
  storeIds: string[],
) {
  const response = await request.patch("/api/admin/users", {
    data: { userId, clientId, storeIds, active: true },
  });
  if (!response.ok()) {
    throw new Error(`Assign user failed: ${await response.text()}`);
  }
}

export async function createProductViaApi(
  request: APIRequestContext,
  barcode: string,
  name: string,
) {
  const response = await request.post("/api/products", {
    data: { barcode, name },
  });
  if (!response.ok()) {
    throw new Error(`Create product failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.product as { id: string; barcode: string; name: string };
}
