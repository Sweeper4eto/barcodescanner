import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/helpers/env";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  globalSetup: "./e2e/global-setup.ts",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx next dev --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      SESSION_SECRET: "e2e-session-secret-32chars!!",
      CRON_SECRET: "e2e-cron-secret",
      SEED_ADMIN_USERNAME: "admin",
      SEED_ADMIN_PASSWORD: "admin123",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
