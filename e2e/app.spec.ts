import { test, expect } from "@playwright/test";
import { loginInBrowser } from "./helpers/auth";

test.describe("Admin UI", () => {
  test("admin panel shows English labels", async ({ page }) => {
    await loginInBrowser(page, "admin", "admin123");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Admin panel")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clients" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Payments" })).toBeVisible();
  });
});

test.describe("Public pages", () => {
  test("home page shows English copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Inventory & expiry management" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("registration creates account and opens the app", async ({ page }) => {
    const username = `reg${Date.now()}`;
    await page.goto("/register");
    await page.getByLabel("Household").check();
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByLabel("Confirm password").fill("password123");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/app/);
  });
});
