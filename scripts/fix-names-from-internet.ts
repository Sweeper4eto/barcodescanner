/**
 * Live-fix dirty product names via non-OFF barcode sources:
 * - Barcode Lookup API (barcodelookup.com) when BARCODELOOKUP_API_KEY is set
 * - Barcode Spider public pages
 * - Buycott public product pages
 * - UPCitemdb trial API (100/day)
 * - Go-UPC public product pages
 *
 *   npx tsx scripts/fix-names-from-internet.ts
 *   npx tsx scripts/fix-names-from-internet.ts --minutes 55 --concurrency 2
 *   npx tsx scripts/fix-names-from-internet.ts --limit 50 --dry-run
 */
import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import {
  cleanProductName,
  isLowQualityProductName,
  pickBestProductName,
} from "../src/lib/product-name";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type Args = {
  minutes: number;
  concurrency: number;
  dryRun: boolean;
  limit: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    minutes: 55,
    concurrency: 2,
    dryRun: false,
    limit: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--minutes") args.minutes = Number(argv[++i] ?? "55");
    else if (argv[i] === "--concurrency")
      args.concurrency = Number(argv[++i] ?? "2");
    else if (argv[i] === "--limit") args.limit = Number(argv[++i] ?? "0");
  }
  return args;
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDirtyName(name: string): boolean {
  const n = name || "";
  if (!n.trim() || n.trim().length < 2) return true;
  if (/^[!#"']/.test(n.trim())) return true;
  if (/(?:&quot;|&amp;|&gt;|Prodhead)/i.test(n)) return true;
  if (/^\d+[A-Za-z]/.test(n.trim())) return true;
  if (isLowQualityProductName(n)) return true;
  const cleaned = cleanProductName(n);
  if (cleaned && cleaned !== n) return true;
  return false;
}

function score(name: string): number {
  const cleaned = cleanProductName(name);
  if (!cleaned) return -1000;
  let s = Math.min(cleaned.length, 100);
  if (isLowQualityProductName(cleaned)) s -= 60;
  if (/^[!#"']/.test(name.trim())) s -= 30;
  if (/(?:&quot;|&amp;|&gt;)/i.test(name)) s -= 20;
  if (/[a-z]/.test(cleaned) && /[A-Z]/.test(cleaned)) s += 8;
  if (/[\u0400-\u04FF]/.test(cleaned)) s += 10;
  return s;
}

function normalizeDigits(barcode: string): string {
  return String(barcode || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
}

function barcodeVariants(barcode: string): string[] {
  const digits = String(barcode || "").replace(/\D/g, "");
  if (!digits) return [];
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  push(digits);
  const stripped = digits.replace(/^0+/, "") || "0";
  push(stripped);
  if (stripped.length < 13) push(stripped.padStart(13, "0"));
  if (stripped.length === 11) push(stripped.padStart(12, "0"));
  return out.slice(0, 3);
}

function significantTokens(name: string): string[] {
  const cleaned = cleanProductName(name).toLowerCase();
  return cleaned
    .split(/[^a-z0-9\u0400-\u04ff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        !["with", "from", "free", "pack", "size", "brand", "product"].includes(
          t,
        ),
    );
}

function namesCompatible(current: string, remote: string): boolean {
  const currentTokens = significantTokens(current);
  if (currentTokens.length === 0) return true;
  const remoteLower = cleanProductName(remote).toLowerCase();
  const hits = currentTokens.filter((t) => remoteLower.includes(t));
  if (currentTokens.length <= 2) return hits.length >= 1;
  return hits.length >= Math.min(2, Math.ceil(currentTokens.length / 3));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function scrubRemoteTitle(raw: string): string {
  return cleanProductName(
    raw
      .replace(/\s*\|?\s*Barcode Spider.*$/i, "")
      .replace(/\s*[-–|]\s*(UPC|EAN|GTIN).*$/i, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function pageMentionsBarcode(html: string, barcode: string): boolean {
  const variants = barcodeVariants(barcode);
  const norms = new Set(variants.map(normalizeDigits));
  for (const v of variants) {
    if (html.includes(v)) return true;
  }
  for (const m of html.matchAll(/\b(\d{8,14})\b/g)) {
    if (norms.has(normalizeDigits(m[1]))) return true;
  }
  return false;
}

let goUpcCooldownUntil = 0;
let upcItemDbCooldownUntil = 0;

async function lookupBarcodeLookup(barcode: string): Promise<string | null> {
  const key = process.env.BARCODELOOKUP_API_KEY?.trim();
  if (!key) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const url = new URL("https://api.barcodelookup.com/v3/products");
      url.searchParams.set("barcode", code);
      url.searchParams.set("key", key);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 404) continue;
      if (!response.ok) continue;
      const data = (await response.json()) as {
        products?: Array<{ product_name?: string; title?: string }>;
      };
      const product = data.products?.[0];
      const name = pickBestProductName([
        product?.product_name,
        product?.title,
      ]);
      if (name) return name;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupBarcodeSpider(barcode: string): Promise<string | null> {
  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(`https://www.barcodespider.com/${code}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      if (/product not found/i.test(html)) continue;
      const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
      const title = html.match(/<title>\s*([^<]+?)\s*<\/title>/i)?.[1];
      const name = scrubRemoteTitle(stripTags(h1 || title || ""));
      if (!name || /product not found/i.test(name)) continue;
      if (!pageMentionsBarcode(html, barcode) && !html.includes(code)) continue;
      return name;
    } catch {
      // next
    }
  }
  return null;
}


let buycottCooldownUntil = 0;

async function lookupBuycott(barcode: string): Promise<string | null> {
  if (Date.now() < buycottCooldownUntil) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(`https://www.buycott.com/upc/${code}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        buycottCooldownUntil = Date.now() + 120_000;
        console.log("buycott rate limited — cooling down 120s");
        return null;
      }
      if (response.status === 404) continue;
      if (!response.ok) continue;
      const html = await response.text();
      if (/no products found|product not found/i.test(html)) continue;
      const og = html.match(/property=["']og:title["']\s+content=["']([^"']+)/i)?.[1];
      const h2 = html.match(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/i)?.[1];
      const name = scrubRemoteTitle(stripTags(og || h2 || ""));
      if (!name || /^buycott$/i.test(name)) continue;
      if (!pageMentionsBarcode(html, barcode) && !html.includes(code)) continue;
      return name;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupGoUpc(barcode: string): Promise<string | null> {
  if (Date.now() < goUpcCooldownUntil) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(
        `https://go-upc.com/search?q=${encodeURIComponent(code)}`,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (response.status === 429) {
        goUpcCooldownUntil = Date.now() + 90_000;
        console.log("go-upc rate limited — cooling down 90s");
        return null;
      }
      if (response.status === 400 || response.status === 404) continue;
      if (!response.ok) continue;
      const html = await response.text();
      if (html.length < 400) continue;
      if (/product not found|no product found/i.test(html)) continue;
      if (!pageMentionsBarcode(html, barcode)) continue;
      const h1 = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1];
      if (!h1) continue;
      const name = scrubRemoteTitle(stripTags(h1));
      if (
        name &&
        !/^go-?upc$/i.test(name) &&
        !/search results/i.test(name) &&
        name.length >= 2
      ) {
        return name;
      }
    } catch {
      // next
    }
  }
  return null;
}

async function lookupUpcItemDb(barcode: string): Promise<string | null> {
  if (Date.now() < upcItemDbCooldownUntil) return null;

  for (const code of barcodeVariants(barcode)) {
    try {
      const response = await fetch(
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
        {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (response.status === 429) {
        upcItemDbCooldownUntil = Date.now() + 45_000;
        console.log("upcitemdb rate limited — cooling down 45s");
        return null;
      }
      if (response.status === 400 || response.status === 404) continue;
      if (!response.ok) continue;
      const data = (await response.json()) as {
        items?: Array<{
          title?: string;
          brand?: string;
          ean?: string;
          upc?: string;
        }>;
      };
      const item = data.items?.[0];
      if (!item) continue;
      const itemCode = normalizeDigits(item.ean || item.upc || code);
      if (itemCode !== normalizeDigits(barcode)) continue;
      const name = pickBestProductName([item.title, item.brand]);
      if (name) return name;
    } catch {
      // next
    }
  }
  return null;
}

async function lookupName(
  barcode: string,
  currentName: string,
): Promise<string | null> {
  const candidates: string[] = [];

  const fromBarcodeLookup = await lookupBarcodeLookup(barcode);
  if (fromBarcodeLookup) candidates.push(fromBarcodeLookup);

  const fromSpider = await lookupBarcodeSpider(barcode);
  if (fromSpider) candidates.push(fromSpider);

  // Secondary free sources when spider misses.
  if (candidates.length === 0) {
    const fromBuycott = await lookupBuycott(barcode);
    if (fromBuycott) candidates.push(fromBuycott);
  }
  if (candidates.length === 0) {
    const fromUpcItemDb = await lookupUpcItemDb(barcode);
    if (fromUpcItemDb) candidates.push(fromUpcItemDb);
  }
  if (candidates.length === 0) {
    const fromGoUpc = await lookupGoUpc(barcode);
    if (fromGoUpc) candidates.push(fromGoUpc);
  }

  const compatible = candidates.filter((c) => namesCompatible(currentName, c));
  return pickBestProductName(compatible) || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL ?? "file:./prod-import.db";
  const dbPath = resolveDbPath(databaseUrl);
  const deadline = Date.now() + args.minutes * 60_000;

  console.log(`Database: ${dbPath}`);
  console.log(
    `Live lookup up to ${args.minutes} min, concurrency ${args.concurrency}`,
  );
  console.log(
    process.env.BARCODELOOKUP_API_KEY
      ? "Barcode Lookup API: key present"
      : "Barcode Lookup API: no BARCODELOOKUP_API_KEY (barcodespider + buycott + upcitemdb + go-upc)",
  );
  if (args.dryRun) console.log("Dry run — no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const candidates = db
    .prepare(
      `
      SELECT id, barcode, name
      FROM Product
      WHERE name GLOB '!*'
         OR name GLOB '#*'
         OR name GLOB '"*'
         OR name GLOB '''*'
         OR name LIKE '%&quot;%'
         OR name LIKE '%&amp;%'
         OR name LIKE '%&gt;%'
         OR name LIKE '%Prodhead%'
         OR length(trim(name)) < 3
         OR name GLOB '[0-9][A-Za-z]*'
         OR name GLOB '[0-9][0-9][A-Za-z]*'
         OR name LIKE '%,%,%'
      ORDER BY length(name), name
      `,
    )
    .all() as Array<{ id: string; barcode: string; name: string }>;

  const queue = candidates.filter((row) => isDirtyName(row.name));
  const limited = args.limit > 0 ? queue.slice(0, args.limit) : queue;

  console.log(`Dirty candidates: ${limited.length}`);

  const update = db.prepare(
    `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
  );

  let index = 0;
  let lookedUp = 0;
  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let errors = 0;
  const examples: Array<{ barcode: string; before: string; after: string }> =
    [];

  async function worker() {
    while (Date.now() < deadline) {
      const current = index;
      index += 1;
      if (current >= limited.length) return;

      const row = limited[current];
      lookedUp += 1;
      try {
        const remote = await lookupName(row.barcode, row.name);
        const local = cleanProductName(row.name);
        const chosen = pickBestProductName([remote, local, row.name]);

        if (chosen && chosen !== row.name && score(chosen) > score(row.name)) {
          if (!args.dryRun) {
            update.run(chosen, new Date().toISOString(), row.id);
          }
          updated += 1;
          if (examples.length < 40) {
            examples.push({
              barcode: row.barcode,
              before: row.name,
              after: chosen,
            });
          }
        } else if (!remote) {
          missing += 1;
        } else {
          unchanged += 1;
        }
      } catch {
        errors += 1;
      }

      if (lookedUp % 25 === 0) {
        const leftMin = Math.max(
          0,
          Math.round((deadline - Date.now()) / 60_000),
        );
        console.log(
          `... ${lookedUp}/${limited.length} looked up | updated ${updated} | missing ${missing} | unchanged ${unchanged} | errors ${errors} | ~${leftMin}m left`,
        );
      }

      await sleep(550);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, args.concurrency) },
    () => worker(),
  );
  await Promise.all(workers);

  console.log("Done.", {
    lookedUp,
    updated,
    missing,
    unchanged,
    errors,
    timedOut: Date.now() >= deadline && index < limited.length,
    remaining: Math.max(0, limited.length - index),
  });
  console.log("Examples:");
  for (const ex of examples) {
    console.log(
      `  ${ex.barcode}\n    before: ${ex.before}\n    after:  ${ex.after}`,
    );
  }
  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});