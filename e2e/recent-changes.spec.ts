import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";
import { assertNoNextJsOverlay, loginViaForm } from "./helpers/auth";
import { e2eDatabaseUrl } from "./helpers/env";
import {
  loginWithStore,
  openExpiryShowingAll,
  provisionHomeOwner,
  skipPwaInstallPrompt,
} from "./helpers/provision";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function seedExpiryItems(
  page: Page,
  storeId: string,
  count: number,
  withImage: boolean,
): Promise<string[]> {
  return page.evaluate(
    async ({ storeId, count, withImage }) => {
      const names: string[] = [];
      const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      for (let index = 0; index < count; index += 1) {
        const barcode = `e2e${Date.now().toString(36)}${index}`;
        const name = `Export ${index} ${Date.now().toString(36)}`;
        const productResponse = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            barcode,
            name,
            ...(withImage ? { imagePath: "/landing/brand-mark.png" } : {}),
          }),
        });
        const productBody = await productResponse.text();
        if (!productResponse.ok) {
          throw new Error(`product ${productResponse.status}: ${productBody}`);
        }
        const product = JSON.parse(productBody) as { product: { id: string } };
        const inventoryResponse = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            storeId,
            barcode,
            productId: product.product.id,
            quantity: 2,
            expiryDate,
          }),
        });
        if (!inventoryResponse.ok) {
          throw new Error(
            `inventory ${inventoryResponse.status}: ${await inventoryResponse.text()}`,
          );
        }
        names.push(name);
      }
      return names;
    },
    { storeId, count, withImage },
  );
}

async function longPress(card: Locator) {
  const box = await card.boundingBox();
  if (!box) throw new Error("expiry card is not visible");
  const page = card.page();
  await page.mouse.move(box.x + Math.min(48, box.width / 2), box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
}

async function selectEveryCard(page: Page) {
  const cards = page.getByRole("article");
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);
    if ((await card.getAttribute("aria-pressed")) === "true") continue;
    await card.getByRole("button", { name: "Select item" }).click();
  }
}

function insertOcrScan(input: {
  userId: string;
  username: string;
  storeId: string;
  createdAt: string;
}) {
  const file = e2eDatabaseUrl.replace(/^file:/, "");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.prepare(
    `INSERT INTO DocumentOcrScan (id, userId, storeId, username, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    `ocr-${input.userId}-${input.createdAt}`,
    input.userId,
    input.storeId,
    input.username,
    input.createdAt,
  );
  db.close();
}

test.describe("Recent product changes", () => {
  test("selection replaces Scan with Export and saves a styled jpeg", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await skipPwaInstallPrompt(page);
    await loginWithStore(page, user);
    const [name] = await seedExpiryItems(page, user.storeId, 1, false);
    await openExpiryShowingAll(page, user.storeId);

    await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);

    const card = page.getByRole("article").filter({ hasText: name! });
    await expect(card).toBeVisible();
    await longPress(card);
    await expect(page.getByRole("heading", { name: /Selected:/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan" })).toHaveCount(0);
    if ((await card.getAttribute("aria-pressed")) !== "true") {
      await card.getByRole("button", { name: "Select item" }).click();
    }

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^expiry-\d{14}\.jpg$/);
    await expect(page.getByText("Picture saved. Open Downloads to find it.")).toBeVisible();

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const bytes = await readFile(filePath!);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(840);

    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    const background = [
      data[2 * info.channels]!,
      data[2 * info.channels + 1]!,
      data[2 * info.channels + 2]!,
    ];
    expect(background.every((channel) => channel < 40)).toBe(true);

    let mint = false;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const red = data[offset]!;
      const green = data[offset + 1]!;
      const blue = data[offset + 2]!;
      if (green > 120 && green > red + 30 && green > blue) {
        mint = true;
        break;
      }
    }
    expect(mint).toBe(true);
    await assertNoNextJsOverlay(page);
  });

  test("more than 20 selected items shows the limit and does not download", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await skipPwaInstallPrompt(page);
    await loginWithStore(page, user);
    await seedExpiryItems(page, user.storeId, 21, false);
    await openExpiryShowingAll(page, user.storeId);
    await expect(page.getByRole("article")).toHaveCount(21, { timeout: 15_000 });

    await longPress(page.getByRole("article").first());
    await expect(page.getByRole("heading", { name: /Selected:/ })).toBeVisible();
    await selectEveryCard(page);
    await expect(page.getByRole("heading", { name: "Selected: 21" })).toBeVisible();

    let downloaded = false;
    page.on("download", () => {
      downloaded = true;
    });
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByText("Maximum is 20 selected.")).toBeVisible();
    await page.waitForTimeout(400);
    expect(downloaded).toBe(false);
    await assertNoNextJsOverlay(page);
  });

  test("iPhone shows the expiry picture for Photos instead of downloading it", async ({
    browser,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    const context = await browser.newContext({
      baseURL,
      userAgent: IPHONE_UA,
    });
    const page = await context.newPage();
    try {
      await skipPwaInstallPrompt(page);
      await loginWithStore(page, user);
      const [name] = await seedExpiryItems(page, user.storeId, 1, false);
      await openExpiryShowingAll(page, user.storeId);
      const card = page.getByRole("article").filter({ hasText: name! });
      await longPress(card);
      if ((await card.getAttribute("aria-pressed")) !== "true") {
        await card.getByRole("button", { name: "Select item" }).click();
      }

      let downloaded = false;
      page.on("download", () => {
        downloaded = true;
      });
      await page.getByRole("button", { name: "Export" }).click();
      await expect(
        page.getByText("Hold the picture, then tap Add to Photos."),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Save" })).toBeVisible();
      expect(downloaded).toBe(false);
      await assertNoNextJsOverlay(page);
    } finally {
      await context.close();
    }
  });

  test("schedule picture saves a png", async ({ page, baseURL }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await skipPwaInstallPrompt(page);
    await loginWithStore(page, user);
    await page.goto(`/app/schedule?storeId=${user.storeId}`);
    const save = page.getByRole("button", { name: "Save week schedule" });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    await save.click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Picture", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^schedule-\d{4}-\d{2}-\d{2}-\d{6}\.png$/);
    await expect(
      page.getByText("Picture saved. Open Downloads to find it."),
    ).toBeVisible();
    const bytes = await readFile((await download.path())!);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("png");
    expect((meta.width ?? 0) > 400).toBe(true);
    await assertNoNextJsOverlay(page);
  });

  test("tap enlarges a real photo; the no-picture art does not", async ({
    page,
    baseURL,
  }) => {
    const user = await provisionHomeOwner(baseURL!, { withProduct: false });
    await skipPwaInstallPrompt(page);
    await loginWithStore(page, user);
    const [plainName] = await seedExpiryItems(page, user.storeId, 1, false);
    const [photoName] = await seedExpiryItems(page, user.storeId, 1, true);
    await openExpiryShowingAll(page, user.storeId);

    await page
      .getByRole("article")
      .filter({ hasText: plainName! })
      .getByRole("button", { name: "View item details" })
      .click();
    const plainSheet = page.getByRole("dialog", { name: plainName! });
    await plainSheet.getByRole("img", { name: "No picture" }).click();
    await expect(page.getByRole("dialog", { name: "View product image" })).toHaveCount(0);
    await plainSheet.getByRole("button", { name: "Cancel" }).click();
    await expect(plainSheet).toHaveCount(0);

    await page
      .getByRole("article")
      .filter({ hasText: photoName! })
      .getByRole("button", { name: "View item details" })
      .click();
    const photo = page
      .getByRole("dialog", { name: photoName! })
      .getByRole("button", { name: "View product image" });
    await expect(photo).toBeVisible();
    await photo.click();
    const zoom = page.getByRole("dialog", { name: "View product image" });
    await expect(zoom).toBeVisible();
    await zoom.locator("img").click();
    await expect(zoom).toHaveCount(0);

    await photo.click();
    await expect(zoom).toBeVisible();
    await zoom.getByRole("button", { name: "Close" }).click();
    await expect(zoom).toHaveCount(0);
    await assertNoNextJsOverlay(page);
  });

  test("admin OCR usage lists the latest scan first", async ({ page, baseURL }) => {
    const first = await provisionHomeOwner(baseURL!, { withProduct: false });
    const second = await provisionHomeOwner(baseURL!, { withProduct: false });
    const [early, late] = [first, second].sort((left, right) =>
      left.username.localeCompare(right.username),
    );
    // The alphabetically later account scanned most recently.
    insertOcrScan({
      userId: early!.userId,
      username: early!.username,
      storeId: early!.storeId,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    insertOcrScan({
      userId: late!.userId,
      username: late!.username,
      storeId: late!.storeId,
      createdAt: new Date().toISOString(),
    });

    await loginViaForm(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole("tab", { name: "OCR usage", exact: true }).click();

    const table = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Scans by user" }) })
      .locator("tbody tr");
    await expect(table.first().locator("td").first()).toHaveText(late!.username);
    await expect(table.nth(1).locator("td").first()).toHaveText(early!.username);
    await assertNoNextJsOverlay(page);
  });
});
