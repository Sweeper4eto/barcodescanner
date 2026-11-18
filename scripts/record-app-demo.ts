/**
 * Short product peek video:
 * intro → landing → register → login → expiry (details + delete) → outro
 *
 *   npm run dev
 *   npx tsx scripts/record-app-demo.ts
 *
 * Optional: DEMO_BASE_URL, DEMO_USERNAME, DEMO_PASSWORD
 */
import fs from "node:fs";
import path from "node:path";
import {
  chromium,
  devices,
  request as playwrightRequest,
  type Locator,
  type Page,
} from "playwright";
import {
  assignUserViaApi,
  createProductViaApi,
  createStoreViaApi,
} from "../e2e/helpers/auth";
import {
  DEFAULT_PASSWORD,
  uniqueBarcode,
  uniqueUsername,
} from "../e2e/helpers/provision";

const BASE = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3001";
const OUT_DIR = path.join(process.cwd(), "assets", "demo");
const VIDEO_DIR = path.join(OUT_DIR, "_raw");
const CURSOR_ID = "__demo_cursor__";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

let lastCursor = { x: 40, y: 80 };

async function ensureCursor(page: Page) {
  try {
    if (page.isClosed()) return;
    await page.evaluate((id) => {
      let style = document.getElementById(`${id}_style`);
      if (!style) {
        style = document.createElement("style");
        style.id = `${id}_style`;
        style.textContent = `
          #${id} {
            position: fixed; left: 0; top: 0; width: 30px; height: 30px;
            margin-left: -8px; margin-top: -8px;
            border-radius: 50%;
            border: 3px solid #111;
            background: #ffd60a;
            box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 4px 14px rgba(0,0,0,0.45);
            pointer-events: none; z-index: 2147483647;
            transform: translate(40px, 80px);
          }
          #${id}.clicking { width: 22px; height: 22px; background: #ff7a00; }
        `;
        document.documentElement.appendChild(style);
      }
      if (!document.getElementById(id)) {
        const el = document.createElement("div");
        el.id = id;
        document.documentElement.appendChild(el);
      }
    }, CURSOR_ID);
  } catch {
    /* navigation */
  }
}

async function setCursorPos(page: Page, x: number, y: number, clicking = false) {
  try {
    if (page.isClosed()) return;
    await page.evaluate(
      ({ id, x, y, clicking }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.classList.toggle("clicking", clicking);
      },
      { id: CURSOR_ID, x, y, clicking },
    );
  } catch {
    /* navigation */
  }
}

async function injectCursor(page: Page) {
  // Reduce chance of PWA/install modal blocking the hub during the tour
  await page.addInitScript(() => {
    try {
      localStorage.setItem("expire365-pwa-install-dismissed", String(Date.now()));
    } catch {
      /* ignore */
    }
  });
  await page.addInitScript((id) => {
    const boot = () => {
      if (document.getElementById(id)) return;
      const style = document.createElement("style");
      style.id = `${id}_style`;
      style.textContent = `
        #${id} {
          position: fixed; left: 0; top: 0; width: 30px; height: 30px;
          margin-left: -8px; margin-top: -8px;
          border-radius: 50%;
          border: 3px solid #111;
          background: #ffd60a;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 4px 14px rgba(0,0,0,0.45);
          pointer-events: none; z-index: 2147483647;
          transform: translate(40px, 80px);
        }
        #${id}.clicking { width: 22px; height: 22px; background: #ff7a00; }
      `;
      document.documentElement.appendChild(style);
      const el = document.createElement("div");
      el.id = id;
      document.documentElement.appendChild(el);
    };
    boot();
    document.addEventListener("DOMContentLoaded", boot);
  }, CURSOR_ID);
}

async function movePointer(page: Page, x: number, y: number, steps = 20) {
  await ensureCursor(page);
  const from = { ...lastCursor };
  for (let i = 1; i <= steps; i += 1) {
    const nx = from.x + ((x - from.x) * i) / steps;
    const ny = from.y + ((y - from.y) * i) / steps;
    try {
      await page.mouse.move(nx, ny);
      await setCursorPos(page, nx, ny);
    } catch {
      break;
    }
  }
  lastCursor = { x, y };
  await pause(250);
}

async function moveTo(page: Page, locator: Locator, steps = 20) {
  await ensureCursor(page);
  const box = await locator.boundingBox();
  if (!box) return;
  await movePointer(page, box.x + box.width / 2, box.y + box.height / 2, steps);
  await pause(400);
}

async function clickSlow(page: Page, locator: Locator) {
  await ensureCursor(page);
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pause(500);
  await moveTo(page, locator);
  await pause(500);
  await setCursorPos(page, lastCursor.x, lastCursor.y, true);
  await pause(150);
  await locator.click({ delay: 90, timeout: 15_000 });
  await setCursorPos(page, lastCursor.x, lastCursor.y, false);
  await pause(1000);
}

async function typeSlow(page: Page, locator: Locator, text: string) {
  await moveTo(page, locator);
  await locator.click({ delay: 40 });
  await pause(350);
  await locator.fill("");
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 70 });
  }
  await pause(600);
}

async function scrollSlow(page: Page, deltaY: number, steps = 7) {
  const step = deltaY / steps;
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, step);
    await pause(300);
  }
  await pause(800);
}

function logoDataUri(): string {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "icons",
    "icon-192.png",
  );
  const b64 = fs.readFileSync(logoPath).toString("base64");
  return `data:image/png;base64,${b64}`;
}

async function showCard(
  page: Page,
  opts: { title: string; body: string; holdMs: number },
) {
  const logo = logoDataUri();
  await page.setContent(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html { color-scheme: only light; }
    html, body { margin: 0; height: 100%; }
    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      background:
        radial-gradient(1200px 600px at 20% 0%, #1f4a38 0%, transparent 55%),
        radial-gradient(900px 500px at 100% 100%, #243448 0%, transparent 50%),
        #101820;
      color: #ffffff;
      padding: 36px 28px 28px;
      box-sizing: border-box;
      min-height: 100%;
    }
    .brand-row {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.85rem;
      margin: 0 0 2rem;
      flex-shrink: 0;
    }
    .brand-row img {
      width: 88px;
      height: 88px;
      object-fit: contain;
      border-radius: 20px;
    }
    .brand {
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-size: 1.45rem;
      font-weight: 750;
      color: #7dffa3;
    }
    .card {
      max-width: 28rem;
      width: 100%;
      text-align: center;
      margin-top: auto;
      margin-bottom: auto;
      padding: 1.35rem 1.15rem;
      border-radius: 1.15rem;
      background: rgba(8, 14, 18, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
      opacity: 1;
    }
    h1 {
      font-size: 1.7rem;
      line-height: 1.25;
      font-weight: 700;
      margin: 0 0 1rem;
      color: #ffffff !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
    }
    p {
      margin: 0;
      font-size: 1.08rem;
      line-height: 1.55;
      font-weight: 500;
      color: #f2f5f4 !important;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    }
  </style>
</head>
<body>
  <div class="brand-row">
    <img src="${logo}" alt="" width="88" height="88" />
    <div class="brand">expire365</div>
  </div>
  <div class="card">
    <h1>${opts.title}</h1>
    <p>${opts.body}</p>
  </div>
</body>
</html>`,
    { waitUntil: "domcontentloaded" },
  );
  await ensureCursor(page);
  // Park cursor in the bottom corner so it doesn’t cover brand/title text
  const vp = page.viewportSize();
  const x = Math.max(24, (vp?.width ?? 412) - 36);
  const y = Math.max(80, (vp?.height ?? 915) - 48);
  await movePointer(page, x, y, 10);
  await pause(opts.holdMs);
}

async function dismissOverlays(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const whatsNew = page.locator(
      '[role="dialog"][aria-labelledby="whats-new-title"]',
    );
    if (await whatsNew.isVisible().catch(() => false)) {
      await pause(1200);
      const gotIt = whatsNew
        .getByRole("button", { name: /разбрах|got it/i })
        .first();
      if (await gotIt.count()) await clickSlow(page, gotIt);
      await whatsNew
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => undefined);
      await pause(400);
      continue;
    }

    const pwa = page.locator(
      '[role="dialog"][aria-label*="началн"], [role="dialog"][aria-label*="home screen" i]',
    );
    if (await pwa.first().isVisible().catch(() => false)) {
      await pause(1100);
      const no = page
        .getByRole("button", { name: /не сега|not now|разбрах|got it/i })
        .first();
      if (await no.count()) await clickSlow(page, no);
      else await page.keyboard.press("Escape");
      await pause(500);
      continue;
    }
    break;
  }
}

async function seedInventory(
  baseURL: string,
  username: string,
  password: string,
  storeId: string,
) {
  const ctx = await playwrightRequest.newContext({ baseURL });
  try {
    const login = await ctx.post("/api/auth/login", {
      data: { username, password },
    });
    if (!login.ok()) throw new Error(`seed login failed: ${await login.text()}`);

    const items = [
      { barcode: uniqueBarcode(), name: "Мляко Верея 3.6%", days: 2, qty: 8 },
      { barcode: uniqueBarcode(), name: "Хляб Добруджа", days: 1, qty: 10 },
      { barcode: uniqueBarcode(), name: "Сирене БДС", days: 14, qty: 6 },
    ];
    for (const item of items) {
      const product = await createProductViaApi(ctx, item.barcode, item.name);
      const inv = await ctx.post("/api/inventory", {
        data: {
          storeId,
          productId: product.id,
          quantity: item.qty,
          expiryDate: daysFromNow(item.days),
        },
      });
      if (!inv.ok()) {
        throw new Error(`inventory failed: ${await inv.text()}`);
      }
    }
  } finally {
    await ctx.dispose();
  }
}

async function ensureDemoUser(): Promise<{
  username: string;
  password: string;
  storeId: string;
}> {
  const existingUser = process.env.DEMO_USERNAME?.trim();
  const password = process.env.DEMO_PASSWORD?.trim() || DEFAULT_PASSWORD;

  if (existingUser) {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE });
    const login = await ctx.post("/api/auth/login", {
      data: { username: existingUser, password },
    });
    if (!login.ok()) throw new Error(`Demo login failed: ${await login.text()}`);
    const me = await ctx.get("/api/auth/me");
    const meJson = (await me.json()) as {
      user: { stores: { id: string }[] };
    };
    const store = meJson.user.stores[0];
    if (!store) throw new Error("Demo user has no store");
    // Refresh a few products so the list looks full
    await seedInventory(BASE, existingUser, password, store.id).catch(() => undefined);
    await ctx.dispose();
    return { username: existingUser, password, storeId: store.id };
  }

  const username = uniqueUsername("demo");
  const adminCtx = await playwrightRequest.newContext({ baseURL: BASE });
  await adminCtx.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  const codeRes = await adminCtx.post("/api/admin/registration-codes", {
    data: { note: "app demo recording" },
  });
  if (!codeRes.ok()) throw new Error(await codeRes.text());
  const { code } = (await codeRes.json()) as { code: { code: string } };
  await adminCtx.dispose();

  const regCtx = await playwrightRequest.newContext({ baseURL: BASE });
  const reg = await regCtx.post("/api/auth/register", {
    data: {
      username,
      password,
      accountType: "retail",
      organizationName: "Демо магазин",
      registrationCode: code.code,
    },
  });
  if (!reg.ok()) throw new Error(`Register failed: ${await reg.text()}`);
  const regBody = (await reg.json()) as {
    user: { id: string; clientId: string };
  };
  await regCtx.dispose();

  const setup = await playwrightRequest.newContext({ baseURL: BASE });
  await setup.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  const store = await createStoreViaApi(setup, regBody.user.clientId, "Централен");
  await assignUserViaApi(
    setup,
    regBody.user.id,
    regBody.user.clientId,
    [store.id],
    "OWNER",
  );
  await setup.dispose();
  await seedInventory(BASE, username, password, store.id);
  return { username, password, storeId: store.id };
}

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const demo = await ensureDemoUser();
  console.log("Demo account:", demo.username);

  const phone = devices["Pixel 7"];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...phone,
    locale: "bg-BG",
    hasTouch: true,
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: phone.viewport!.width, height: phone.viewport!.height },
    },
  });
  const page = await context.newPage();
  await injectCursor(page);

  try {
    // ── Intro ──────────────────────────────────────────────
    console.log("Intro");
    await showCard(page, {
      title: "Кратък поглед към продукта",
      body: "Само една кратка обиколка — достатъчно да усетите как expire365 работи в магазина.",
      holdMs: 4200,
    });

    // ── Landing ────────────────────────────────────────────
    console.log("Landing");
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await ensureCursor(page);
    await movePointer(page, 200, 280, 16);
    await pause(2200);
    await scrollSlow(page, 520);
    await scrollSlow(page, 420);
    await pause(1200);
    await scrollSlow(page, -700, 8);
    await pause(1000);

    // ── Register (show the form, don’t submit) ─────────────
    console.log("Register");
    const registerCta = page
      .getByRole("link", { name: /регистрация|register/i })
      .first();
    if (await registerCta.count()) {
      await clickSlow(page, registerCta);
    } else {
      await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
      await ensureCursor(page);
      await pause(1200);
    }
    await pause(1400);

    const org = page.locator('input[name="organizationName"]').first();
    const user = page.locator('input[name="username"]').first();
    const pass = page.locator('input[name="password"]').first();
    const code = page.locator('input[name="registrationCode"]').first();
    if (await org.count()) await typeSlow(page, org, "Моят магазин ООД");
    if (await user.count()) await typeSlow(page, user, "demo_store_01");
    if (await pass.count()) await typeSlow(page, pass, "password123");
    if (await code.count()) await typeSlow(page, code, "12345678");
    await scrollSlow(page, 280);
    const createBtn = page
      .getByRole("button", { name: /създай|create|регистр/i })
      .first();
    if (await createBtn.count()) {
      await moveTo(page, createBtn);
      await pause(1400);
    }

    // ── Login ──────────────────────────────────────────────
    console.log("Login");
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await ensureCursor(page);
    await pause(1400);
    await typeSlow(
      page,
      page.locator("#login-username, input[name='username']").first(),
      demo.username,
    );
    await typeSlow(
      page,
      page.locator("#login-password, input[name='password']").first(),
      demo.password,
    );
    await clickSlow(page, page.getByRole("button", { name: /Log in|Вход/i }));
    await page.waitForURL(/\/app/, { timeout: 25_000 });
    await ensureCursor(page);
    await pause(1200);
    await dismissOverlays(page);
    await pause(1600);

    // ── Expiry list via hub tile “Годност” ─────────────────
    console.log("Expiry");
    await page.goto(`${BASE}/app?storeId=${demo.storeId}`, {
      waitUntil: "domcontentloaded",
    });
    await ensureCursor(page);
    await dismissOverlays(page);
    await pause(1200);

    const expiryTile = page
      .locator("button.home-hub-tile")
      .filter({ hasText: /Годност|Expiry/i })
      .first();
    if (await expiryTile.count()) {
      await clickSlow(page, expiryTile);
    } else {
      // Fallback if tile missing
      await page.goto(`${BASE}/app/expiry?storeId=${demo.storeId}`, {
        waitUntil: "domcontentloaded",
      });
      await ensureCursor(page);
    }
    await dismissOverlays(page);
    await page.waitForURL(/\/app\/expiry/, { timeout: 15_000 }).catch(() => undefined);
    await pause(2200);
    await scrollSlow(page, 220);

    // Open item details
    const card = page
      .locator("button, a, [role='button']")
      .filter({ hasText: /Мляко|Хляб|Сирене|Верея|Добруджа/i })
      .first();
    if (!(await card.count())) {
      throw new Error("No expiry item found to open");
    }
    await clickSlow(page, card);
    await pause(1800);

    const sheet = page.locator('[role="dialog"][aria-modal="true"]').last();
    await sheet.waitFor({ state: "visible", timeout: 10_000 });
    await pause(1200);

    // Quantity nudge
    const qtyPlus = sheet
      .getByRole("button", { name: /увеличи количество|increase quantity/i })
      .first();
    if (await qtyPlus.count()) {
      await clickSlow(page, qtyPlus);
      await pause(600);
    }

    // Discount toggle + percent
    const toggle = sheet
      .getByRole("switch", { name: /намалена цена|price reduced/i })
      .first();
    if (await toggle.count()) {
      await clickSlow(page, toggle);
      await pause(900);
      const pct50 = sheet.getByRole("button", { name: /−?\s*50\s*%/ }).first();
      if (await pct50.count()) await clickSlow(page, pct50);
      await pause(1200);
    }

    await scrollSlow(page, 260);
    await pause(1000);

    // Delete / remove — confirm this time
    const remove = sheet
      .getByRole("button", { name: /премахн|изтри|remove|брак|write.?off/i })
      .first();
    if (await remove.count()) {
      await clickSlow(page, remove);
      await pause(1400);
      const confirmDlg = page.locator('[role="dialog"]').last();
      const confirm = confirmDlg
        .getByRole("button", {
          name: /премахн|изтри|remove|брак|потвърд|confirm|да/i,
        })
        .first();
      // Prefer a destructive confirm; avoid "Отказ"
      if (await confirm.count()) {
        const label = ((await confirm.textContent()) || "").toLowerCase();
        if (!/отказ|cancel|назад/.test(label)) {
          await clickSlow(page, confirm);
        } else {
          // Try second button in footer
          const buttons = confirmDlg.getByRole("button");
          const n = await buttons.count();
          for (let i = 0; i < n; i += 1) {
            const b = buttons.nth(i);
            const t = ((await b.textContent()) || "").toLowerCase();
            if (/премахн|изтри|брак|remove|confirm|да/.test(t) && !/отказ|cancel/.test(t)) {
              await clickSlow(page, b);
              break;
            }
          }
        }
      }
      await pause(1600);
    } else {
      await page.keyboard.press("Escape");
    }

    // Back to list / hub
    await pause(1000);
    if (await sheet.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await pause(800);
    }
    await pause(1400);
    await page.goto(`${BASE}/app?storeId=${demo.storeId}`, {
      waitUntil: "domcontentloaded",
    });
    await ensureCursor(page);
    await dismissOverlays(page);
    await pause(2000);

    // ── Outro ──────────────────────────────────────────────
    console.log("Outro");
    await showCard(page, {
      title: "Това е само бърз преглед",
      body: "С expire365 идват още десетки функции — сканиране, документи, задачи, екип, статистика и още много.",
      holdMs: 6500,
    });
  } finally {
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const rawPath = await video.path();
      const dest = path.join(OUT_DIR, "expire365-app-demo.webm");
      fs.copyFileSync(rawPath, dest);
      try {
        fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
      console.log(`Demo video: ${dest} (${mb} MB)`);
    } else {
      console.error("No video captured");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
