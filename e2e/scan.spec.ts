import { test, expect } from "@playwright/test";
import {
  assignUserViaApi,
  createClientViaApi,
  createProductViaApi,
  createStoreViaApi,
  loginInBrowser,
  registerUserViaApi,
  withAdminApi,
} from "./helpers/auth";

const baseURL = "http://127.0.0.1:3100";

async function provisionWorkerWithStore() {
  const username = `scan${Date.now()}`;
  const barcode = `590${String(Date.now()).slice(-10)}`;

  return withAdminApi(baseURL, async (api) => {
    const client = await createClientViaApi(api, `Scan Client ${Date.now()}`, 20);
    const store = await createStoreViaApi(api, client.id, "Scan Store");
    const user = await registerUserViaApi(api, username);
    await assignUserViaApi(api, user.id, client.id, [store.id]);
    const product = await createProductViaApi(api, barcode, "Scan Product");
    return { username, barcode, storeId: store.id, productName: product.name };
  });
}

async function openScanPage(
  page: import("@playwright/test").Page,
  storeId: string,
  barcode?: string,
) {
  const query = new URLSearchParams({ storeId });
  if (barcode) query.set("barcode", barcode);
  await page.goto(`/app/scan?${query.toString()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("scan-flow-ready")).toBeVisible({ timeout: 15_000 });
}

async function enterManualBarcode(page: import("@playwright/test").Page, barcode: string) {
  const input = page.getByTestId("barcode-manual-input");
  await input.click();
  await input.fill("");
  await input.pressSequentially(barcode);
  await expect(page.getByTestId("scanner-confirm-barcode")).toBeEnabled();
}

test.describe("Scan flow", () => {
  test("URL barcode triggers lookup and shows product without error page", async ({ page }) => {
    const { username, barcode, storeId, productName } = await provisionWorkerWithStore();

    await loginInBrowser(page, username, "password123");
    await page.evaluate((id) => localStorage.setItem("magazin_selected_store", id), storeId);

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/products?") && res.request().method() === "GET",
    );
    await openScanPage(page, storeId, barcode);
    const response = await responsePromise;

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { product?: { name: string } };
    expect(body.product?.name).toBe(productName);

    await expect(page.locator("html#__next_error__")).toHaveCount(0);
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  });

  test("URL barcode for unknown product shows missing prompt without error page", async ({
    page,
  }) => {
    const { username, storeId } = await provisionWorkerWithStore();

    await loginInBrowser(page, username, "password123");
    await page.evaluate((id) => localStorage.setItem("magazin_selected_store", id), storeId);

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/products?") && res.request().method() === "GET",
    );
    await openScanPage(page, storeId, "9999999999999");
    const response = await responsePromise;

    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { product?: unknown };
    expect(body.product).toBeNull();

    await expect(page.locator("html#__next_error__")).toHaveCount(0);
    await expect(page.getByText(/would you like to add it/i)).toBeVisible();
  });

  test("manual barcode confirm shows product without error page", async ({ page }) => {
    const { username, barcode, storeId, productName } = await provisionWorkerWithStore();

    await loginInBrowser(page, username, "password123");
    await page.evaluate((id) => localStorage.setItem("magazin_selected_store", id), storeId);
    await openScanPage(page, storeId);

    await enterManualBarcode(page, barcode);

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/products?") && res.request().method() === "GET",
    );
    await page.getByTestId("scanner-confirm-barcode").click();
    const response = await responsePromise;

    expect(response.ok()).toBeTruthy();
    await expect(page.locator("html#__next_error__")).toHaveCount(0);
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
  });

  test("manual barcode confirm for unknown product shows missing prompt without error page", async ({
    page,
  }) => {
    const { username, storeId } = await provisionWorkerWithStore();

    await loginInBrowser(page, username, "password123");
    await page.evaluate((id) => localStorage.setItem("magazin_selected_store", id), storeId);
    await openScanPage(page, storeId);

    await enterManualBarcode(page, "9999999999999");
    await page.getByTestId("scanner-confirm-barcode").click();

    await expect(page.locator("html#__next_error__")).toHaveCount(0);
    await expect(page.getByText(/would you like to add it/i)).toBeVisible();
  });
});
