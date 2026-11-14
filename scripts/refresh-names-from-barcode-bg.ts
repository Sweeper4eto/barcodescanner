/**
 * Refresh dirty Product.name rows from barcode.bg (Microinvest BG catalog).
 *
 * Run clean-product-names.ts first (local). This script then queues remaining
 * dirty names: missing, digits-only, symbols-only, name==barcode, starts with
 * digit/symbol, or disallowed specials (allowed: "Кисело Мляко 3.5 %").
 * Use --all to scan every product.
 *
 * Polite single-thread requests with adaptive delay:
 * - on rate-limit / timeout → cooldown, then permanently slow down
 * - after a streak of OK responses → gently speed back toward the base delay
 * Progress (including current delay) is saved for --resume.
 *
 *   npx tsx scripts/refresh-names-from-barcode-bg.ts --dry-run --limit 20
 *   npx tsx scripts/refresh-names-from-barcode-bg.ts
 *   npx tsx scripts/refresh-names-from-barcode-bg.ts --resume
 *   npx tsx scripts/refresh-names-from-barcode-bg.ts --force
 *   npx tsx scripts/refresh-names-from-barcode-bg.ts --all
 *
 * Optional overrides: --delay-ms (starting delay), --min-delay-ms, --max-delay-ms
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  cleanProductName,
  isAcceptableInternetProductName,
  isDirtyProductName,
  pickBestProductName,
} from "../src/lib/product-name";

const USER_AGENT =
  "Expire365NameRefresh/1.0 (+local catalog maintenance; polite single-thread)";
const SEARCH_PATH =
  "/barcode/BG/%D0%98%D0%BD%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%86%D0%B8%D1%8F-%D0%B7%D0%B0-%D0%B1%D0%B0%D1%80%D0%BA%D0%BE%D0%B4.htm";

type Args = {
  dryRun: boolean;
  limit: number;
  /** Starting / preferred steady delay between requests. */
  delayMs: number;
  minDelayMs: number;
  maxDelayMs: number;
  /** Base cooldown after a block; grows automatically with consecutive hits. */
  cooldownMs: number;
  resume: boolean;
  force: boolean;
  onlyDirty: boolean;
  timeoutMs: number;
};

type Progress = {
  lastId: string;
  lookedUp: number;
  updated: number;
  missing: number;
  skipped: number;
  errors: number;
  rateLimited: number;
  /** Live adaptive delay (persisted across --resume). */
  delayMs: number;
  updatedAt: string;
};

type RankedName = { name: string; rating: number };

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    limit: 0,
    delayMs: 3500,
    minDelayMs: 2000,
    maxDelayMs: 30_000,
    cooldownMs: 3 * 60_000,
    resume: false,
    force: false,
    onlyDirty: true,
    timeoutMs: 20_000,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--resume") args.resume = true;
    else if (a === "--force") args.force = true;
    else if (a === "--only-dirty") args.onlyDirty = true;
    else if (a === "--all") args.onlyDirty = false;
    else if (a === "--limit") args.limit = Number(argv[++i] ?? "0");
    else if (a === "--delay-ms") args.delayMs = Number(argv[++i] ?? "3500");
    else if (a === "--min-delay-ms")
      args.minDelayMs = Number(argv[++i] ?? "2000");
    else if (a === "--max-delay-ms")
      args.maxDelayMs = Number(argv[++i] ?? "30000");
    else if (a === "--cooldown-ms")
      args.cooldownMs = Number(argv[++i] ?? String(3 * 60_000));
    else if (a === "--timeout-ms")
      args.timeoutMs = Number(argv[++i] ?? "20000");
  }
  args.minDelayMs = Math.max(500, args.minDelayMs);
  args.maxDelayMs = Math.max(args.minDelayMs, args.maxDelayMs);
  args.delayMs = Math.min(
    args.maxDelayMs,
    Math.max(args.minDelayMs, args.delayMs),
  );
  return args;
}

function clampDelay(ms: number, minMs: number, maxMs: number): number {
  return Math.min(maxMs, Math.max(minMs, Math.round(ms)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDbPath(databaseUrl: string): string {
  const raw = databaseUrl.replace(/^file:/, "");
  if (path.isAbsolute(raw)) return raw;
  return path.join(process.cwd(), raw);
}

function progressPath(): string {
  return path.join(process.cwd(), "data", "barcode-bg-progress.json");
}

function changeLogPath(): string {
  return path.join(process.cwd(), "data", "barcode-bg-changes.jsonl");
}

function loadProgress(): Progress | null {
  const file = progressPath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Progress;
  } catch {
    return null;
  }
}

function saveProgress(progress: Progress): void {
  const file = progressPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(progress, null, 2), "utf8");
}

function appendChangeLog(entry: Record<string, unknown>): void {
  const file = changeLogPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf8");
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function scoreName(name: string): number {
  const cleaned = cleanProductName(name);
  if (!cleaned) return -1000;
  let s = Math.min(cleaned.length, 100);
  if (isDirtyProductName(cleaned)) s -= 60;
  if (/[\u0400-\u04FF]/.test(cleaned)) s += 15;
  if (/[a-zа-я]/u.test(cleaned) && /[A-ZА-Я]/u.test(cleaned)) s += 5;
  return s;
}

function shouldAcceptRemote(
  current: string,
  remote: string,
  force: boolean,
  barcode?: string,
): boolean {
  if (!isAcceptableInternetProductName(remote)) return false;
  if (force) return true;
  if (!current.trim()) return true;
  if (isDirtyProductName(current, barcode)) {
    return scoreName(remote) > scoreName(current) - 5;
  }
  return scoreName(remote) > scoreName(current) + 8;
}

function parseRankedNames(html: string): RankedName[] {
  const tableMatch = html.match(
    /<table[^>]*class=["'][^"']*randomBarcodes[^"']*["'][^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) return [];

  const rows: RankedName[] = [];
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>\s*\d+\s*<\/td>\s*<td[^>]*>\s*([\d\s]+)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<\/tr>/gi;

  for (const match of tableMatch[1].matchAll(rowRe)) {
    const name = cleanProductName(
      decodeBasicEntities(stripTags(match[2] || "")),
    );
    const rating = Number(match[3] || "0");
    if (!name || name.length < 2) continue;
    rows.push({ name, rating: Number.isFinite(rating) ? rating : 0 });
  }

  rows.sort((a, b) => b.rating - a.rating || b.name.length - a.name.length);
  return rows;
}

function parseImgTitle(html: string): string | null {
  const m =
    html.match(
      /<img[^>]*class=["'][^"']*barcodeImg[^"']*["'][^>]*(?:alt|title)=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<img[^>]*(?:alt|title)=["']([^"']+)["'][^>]*class=["'][^"']*barcodeImg[^"']*["']/i,
    );
  if (!m?.[1]) return null;
  const raw = decodeBasicEntities(m[1]);
  const withoutBarcode = raw.replace(/\s*[-–—]\s*Баркод\s*:.*/i, "").trim();
  const cleaned = cleanProductName(withoutBarcode);
  return cleaned || null;
}

class RateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitedError";
  }
}

async function lookupBarcodeBg(
  barcode: string,
  timeoutMs: number,
): Promise<string | null> {
  const digits = String(barcode || "").replace(/\D/g, "");
  if (digits.length < 4) return null;

  const url = `https://barcode.bg${SEARCH_PATH}?barcode=${encodeURIComponent(digits)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "bg,en;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timeout|aborted|ECONNRESET|ETIMEDOUT|429/i.test(message)) {
      throw new RateLimitedError(message);
    }
    throw error;
  }

  if (response.status === 429 || response.status === 503) {
    throw new RateLimitedError(`HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  // Real challenge pages embed securimage; normal pages only mention CAPTCHA
  // in unused jsLabels strings — do not treat those as a block.
  if (
    /securimage_show\.php|id=["']captcha_code["']|too many requests|rate limit exceeded|достъпът е ограничен/i.test(
      html,
    )
  ) {
    throw new RateLimitedError("captcha/block page");
  }

  const ranked = parseRankedNames(html);
  if (ranked.length > 0) {
    const best = pickBestProductName(ranked.map((row) => row.name));
    if (best) return best;
    return ranked[0]?.name ?? null;
  }

  const fromImg = parseImgTitle(html);
  if (fromImg && isAcceptableInternetProductName(fromImg)) return fromImg;

  // Explicit empty result page is fine — not rate limited.
  if (/Резултати от търсене/i.test(html)) return null;
  if (html.length < 1500) throw new RateLimitedError("suspiciously short page");
  return null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const dbPath = resolveDbPath(databaseUrl);

  console.log("barcode.bg name refresh (adaptive delay)");
  console.log(`DB: ${dbPath}`);
  console.log(
    `startDelay=${args.delayMs}ms range=${args.minDelayMs}-${args.maxDelayMs}ms baseCooldown=${args.cooldownMs}ms force=${args.force} onlyDirty=${args.onlyDirty}`,
  );
  if (args.dryRun) console.log("Dry run — no writes.");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  const progress = args.resume ? loadProgress() : null;
  if (progress?.lastId) {
    console.log(
      `Resuming after id=${progress.lastId} (lookedUp=${progress.lookedUp}, updated=${progress.updated}, delay=${progress.delayMs ?? args.delayMs}ms)`,
    );
  } else if (args.resume) {
    console.log("No progress file — starting from the beginning.");
  }

  let delayMs = clampDelay(
    progress?.delayMs && args.resume ? progress.delayMs : args.delayMs,
    args.minDelayMs,
    args.maxDelayMs,
  );
  let okStreak = 0;
  let consecutiveBlocks = 0;

  // Page the full catalog; JS applies the full dirty rules (incl. leading digit/symbol).
  const pageQuery = db.prepare(`
    SELECT id, barcode, name
    FROM Product
    WHERE id > ?
    ORDER BY id
    LIMIT ?
  `);
  const pageSize = 5000;
  const rows: Array<{ id: string; barcode: string; name: string }> = [];
  let scanId = progress?.lastId ?? "";
  let scanned = 0;
  console.log(
    "Building dirty queue (after local clean: missing / digits / symbols / barcode clone / leading junk / bad specials)…",
  );
  while (true) {
    if (args.limit > 0 && rows.length >= args.limit) break;
    const page = pageQuery.all(scanId, pageSize) as Array<{
      id: string;
      barcode: string;
      name: string;
    }>;
    if (!page.length) break;
    for (const row of page) {
      scanned += 1;
      if (!args.onlyDirty || isDirtyProductName(row.name, row.barcode)) {
        rows.push(row);
        if (args.limit > 0 && rows.length >= args.limit) break;
      }
    }
    scanId = page[page.length - 1].id;
    if (scanned % 500_000 < pageSize) {
      console.log(`... scanned ${scanned}, dirty so far ${rows.length}`);
    }
    if (page.length < pageSize) break;
  }

  const limited = rows;
  console.log(`Queue: ${limited.length} products (scanned ${scanned})`);

  const update = db.prepare(
    `UPDATE Product SET name = ?, updatedAt = ? WHERE id = ?`,
  );

  const stats: Progress = {
    lastId: progress?.lastId ?? "",
    lookedUp: progress?.lookedUp ?? 0,
    updated: progress?.updated ?? 0,
    missing: progress?.missing ?? 0,
    skipped: progress?.skipped ?? 0,
    errors: progress?.errors ?? 0,
    rateLimited: progress?.rateLimited ?? 0,
    delayMs,
    updatedAt: new Date().toISOString(),
  };

  const examples: Array<{ barcode: string; before: string; after: string }> =
    [];

  for (let i = 0; i < limited.length; i += 1) {
    const row = limited[i];
    stats.lookedUp += 1;
    stats.lastId = row.id;
    stats.delayMs = delayMs;
    stats.updatedAt = new Date().toISOString();

    try {
      const remote = await lookupBarcodeBg(row.barcode, args.timeoutMs);
      consecutiveBlocks = 0;
      okStreak += 1;
      // After a calm stretch, ease delay back toward the preferred base.
      if (okStreak >= 40 && delayMs > args.delayMs) {
        const next = clampDelay(
          delayMs * 0.9,
          args.delayMs,
          args.maxDelayMs,
        );
        if (next < delayMs) {
          delayMs = next;
          stats.delayMs = delayMs;
          console.log(
            `OK streak ${okStreak} — easing delay to ${delayMs}ms`,
          );
        }
        okStreak = 0;
      }

      if (!remote) {
        stats.missing += 1;
      } else if (
        shouldAcceptRemote(row.name, remote, args.force, row.barcode)
      ) {
        const chosen = cleanProductName(remote);
        if (chosen && chosen !== row.name) {
          if (!args.dryRun) {
            update.run(chosen, new Date().toISOString(), row.id);
            appendChangeLog({
              action: "update",
              id: row.id,
              barcode: row.barcode,
              before: row.name,
              after: chosen,
              source: "barcode.bg",
              at: new Date().toISOString(),
            });
          }
          stats.updated += 1;
          if (examples.length < 30) {
            examples.push({
              barcode: row.barcode,
              before: row.name,
              after: chosen,
            });
          }
        } else {
          stats.skipped += 1;
        }
      } else {
        stats.skipped += 1;
      }
    } catch (error) {
      if (error instanceof RateLimitedError) {
        stats.rateLimited += 1;
        okStreak = 0;
        consecutiveBlocks += 1;
        delayMs = clampDelay(
          delayMs * 1.8,
          args.minDelayMs,
          args.maxDelayMs,
        );
        stats.delayMs = delayMs;
        const cooldown = Math.min(
          30 * 60_000,
          Math.round(args.cooldownMs * Math.pow(1.5, consecutiveBlocks - 1)),
        );
        console.warn(
          `Rate limited / blocked on ${row.barcode}: ${error.message}`,
        );
        console.warn(
          `Auto: cooldown ${Math.round(cooldown / 1000)}s, then delay=${delayMs}ms (block #${consecutiveBlocks})`,
        );
        saveProgress(stats);
        await sleep(cooldown);
        // Retry same barcode after cooldown.
        i -= 1;
        stats.lookedUp -= 1;
        continue;
      }
      stats.errors += 1;
      okStreak = 0;
      console.warn(
        `Error ${row.barcode}: ${error instanceof Error ? error.message : error}`,
      );
    }

    if (stats.lookedUp % 25 === 0 || i === limited.length - 1) {
      saveProgress(stats);
      console.log(
        `... ${i + 1}/${limited.length} | updated ${stats.updated} | missing ${stats.missing} | skipped ${stats.skipped} | errors ${stats.errors} | rateLimited ${stats.rateLimited} | delay ${delayMs}ms`,
      );
    }

    if (i < limited.length - 1) {
      await sleep(delayMs);
    }
  }

  saveProgress(stats);
  db.close();

  console.log("Done.", stats);
  if (examples.length > 0) {
    console.log("Examples:");
    for (const ex of examples) {
      console.log(
        `  ${ex.barcode}\n    before: ${ex.before}\n    after:  ${ex.after}`,
      );
    }
  }
  console.log(`Progress: ${progressPath()}`);
  console.log(`Changes:  ${changeLogPath()}`);
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("refresh-names-from-barcode-bg.ts") ||
    process.argv[1].endsWith("refresh-names-from-barcode-bg.js"));

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
