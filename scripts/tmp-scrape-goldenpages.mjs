/**
 * Scrape Golden Pages "хранителни стоки" (all pages) → Excel by city tabs.
 * Excludes Billa / Kaufland / Minimart / Fantastico.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(
  __dirname,
  "..",
  "assets",
  "offers",
  "goldenpages-hranitelni-stoki.xlsx",
);
const PROGRESS = path.join(__dirname, "_gp_progress.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// No \b — JS word boundaries break on Cyrillic
const EXCLUDE =
  /(била|билла|billa|кауфланд|kaufland|минимарт|minimart|фантастико|fantastico)/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pageUrl(page) {
  const product = encodeURIComponent("хранителни стоки");
  // Site puts /page/N inside the location value (lowercase encoding)
  const location =
    page <= 1
      ? encodeURIComponent("България")
      : `${encodeURIComponent("българия")}/page/${page}`;
  return `https://www.goldenpages.bg/bg/search/results?search[product]=${product}&search[location]=${location}`;
}

async function fetchPage(page) {
  const url = pageUrl(page);
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "bg-BG,bg;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${page}`);
  return await res.text();
}

function clean(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function normalizePhone(phone) {
  let p = clean(phone);
  if (!p) return "";
  if (p.startsWith("+359")) {
    p = "0" + p.slice(4);
  }
  return p.replace(/[^\d]/g, "").replace(/^359/, "0");
}

function formatPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits) return clean(phone);
  return digits;
}

/** Premium / paid listings (mostly page 1) */
function parsePremium(html) {
  const items = [];
  const re =
    /company-list-item-container[\s\S]*?<div class="h4">\s*<a href="\/bg\/o\/[^"]+-(\d+)">\s*([^<]+?)\s*<\/a>([\s\S]*?)<\/div>\s*<p>\s*<span[^>]*itemprop="addressLocality"[^>]*>([^<]*)<\/span>\s*,\s*<span[^>]*itemprop="streetAddress"[^>]*>([^<]*)<\/span>/gi;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const name = clean(m[2]);
    const block = m[3];
    const city = clean(m[4]);
    const street = clean(m[5]);
    const phoneM =
      block.match(/href="tel:(\+?\d+)"/i) || block.match(/title="(\d+)"/);
    items.push({
      id,
      name,
      phone: formatPhone(phoneM ? phoneM[1] : ""),
      city,
      street,
      source: "premium",
    });
  }
  return items;
}

/** Free listings (pages 2+) */
function parseBasic(html) {
  const items = [];
  const re =
    /data-gp-company="(\d+)"[\s\S]*?<div class="single-product">\s*<div class="h4">\s*<a href="\/bg\/[^"]+">([^<]+)<\/a>\s*<\/div>([\s\S]*?)(?=data-gp-company="|class="pagination"|<\/section|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const name = clean(m[2]);
    const body = m[3];
    const phoneM = body.match(/Телефон:\s*([^<]+)/i);
    const cityM = body.match(/itemprop="addressLocality"[^>]*>([^<]*)</i);
    const streetM = body.match(/itemprop="streetAddress"[^>]*>([^<]*)</i);
    items.push({
      id,
      name,
      phone: formatPhone(phoneM ? phoneM[1] : ""),
      city: cityM ? clean(cityM[1]) : "",
      street: streetM ? clean(streetM[1]) : "",
      source: "basic",
    });
  }
  return items;
}

function detectMaxPage(html) {
  const pages = [...html.matchAll(/\/page\/(\d+)/g)].map((m) => Number(m[1]));
  return pages.length ? Math.max(...pages) : 1;
}

function sheetName(city) {
  let name = (city || "Без град").replace(/[\\/*?:\[\]]/g, " ").trim();
  if (!name) name = "Без град";
  if (name.length > 31) name = name.slice(0, 31);
  return name;
}

function buildWorkbook(rows) {
  const byCity = new Map();
  for (const r of rows) {
    const city = r.city || "Без град";
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(r);
  }

  const cities = [...byCity.keys()].sort((a, b) =>
    a.localeCompare(b, "bg"),
  );

  const wb = XLSX.utils.book_new();

  // Summary first
  const allSorted = [...rows].sort((a, b) => {
    const c = a.city.localeCompare(b.city, "bg");
    if (c) return c;
    const s = a.street.localeCompare(b.street, "bg");
    if (s) return s;
    return a.phone.localeCompare(b.phone, "bg");
  });
  const summaryAoA = [
    ["Град", "Име", "Адрес", "Телефон"],
    ...allSorted.map((r) => [r.city, r.name, r.street, r.phone]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryAoA),
    "Всички",
  );

  const usedNames = new Set(["Всички"]);
  for (const city of cities) {
    const list = byCity.get(city).sort((a, b) => {
      const s = a.street.localeCompare(b.street, "bg");
      if (s) return s;
      const p = a.phone.localeCompare(b.phone, "bg");
      if (p) return p;
      return a.name.localeCompare(b.name, "bg");
    });
    let name = sheetName(city);
    let n = 2;
    while (usedNames.has(name)) {
      const base = sheetName(city).slice(0, 28);
      name = `${base}_${n++}`;
    }
    usedNames.add(name);
    const aoa = [
      ["Име", "Адрес", "Телефон"],
      ...list.map((r) => [r.name, r.street, r.phone]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return wb;
}

async function main() {
  console.log("Fetching page 1…");
  const html1 = await fetchPage(1);
  const maxPage = detectMaxPage(html1);
  console.log("Max page:", maxPage);

  /** @type {Map<string, object>} */
  const byKey = new Map();

  function addAll(items, page) {
    let kept = 0;
    let skipped = 0;
    for (const it of items) {
      if (EXCLUDE.test(it.name)) {
        skipped += 1;
        continue;
      }
      const key = it.id || `${it.name}|${it.phone}|${it.city}|${it.street}`;
      if (!byKey.has(key)) {
        byKey.set(key, it);
        kept += 1;
      }
    }
    console.log(
      `page ${page}: +${items.length} parsed, +${kept} new, -${skipped} excluded; total ${byKey.size}`,
    );
  }

  addAll([...parsePremium(html1), ...parseBasic(html1)], 1);

  for (let page = 2; page <= maxPage; page += 1) {
    let html;
    let tries = 0;
    for (;;) {
      tries += 1;
      try {
        html = await fetchPage(page);
        break;
      } catch (err) {
        console.warn(`page ${page} error (try ${tries}):`, err.message);
        if (tries >= 5) throw err;
        await sleep(2000 * tries);
      }
    }
    const items = [...parsePremium(html), ...parseBasic(html)];
    if (items.length === 0) {
      console.warn(`page ${page}: 0 items — retry once`);
      await sleep(1500);
      html = await fetchPage(page);
      addAll([...parsePremium(html), ...parseBasic(html)], page);
    } else {
      addAll(items, page);
    }
    if (page % 25 === 0) {
      fs.writeFileSync(
        PROGRESS,
        JSON.stringify({ page, total: byKey.size, at: new Date().toISOString() }),
      );
    }
    await sleep(250);
  }

  const rows = [...byKey.values()];
  console.log("Writing", rows.length, "rows →", OUT);
  const wb = buildWorkbook(rows);
  XLSX.writeFile(wb, OUT);
  console.log("Done. Cities:", wb.SheetNames.length - 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
