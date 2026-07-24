import { readFile } from "node:fs/promises";
import "dotenv/config";
import { z } from "zod";
import { sanitizeDocumentRows } from "@/lib/document-row-sanitize";
import { resolveLocalUploadPath } from "@/lib/upload";

const rowSchema = z.object({
  name: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  articul: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  /** Exact Godnost cell as printed, e.g. "01.12.2027" (day.month.year). */
  expiryPrinted: z.string().optional().nullable(),
  quantity: z.union([z.number(), z.string()]).optional().nullable(),
});

const rowsSchema = z.object({
  items: z.array(rowSchema),
});

export type DocumentOcrRow = {
  name: string;
  barcode: string | null;
  articul: string | null;
  expiryYmd: string | null;
  quantity: number;
};

function stripDataUrl(dataUrl: string): { mime: string; base64: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("INVALID_IMAGE");
  }
  return { mime: match[1], base64: match[2] };
}

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Parse common EU/BG date strings into YYYY-MM-DD. */
export function parseDocumentExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  // Bulgarian / EU documents use day.month.year (not US month/day).
  // Allow trailing lot/batch text, e.g. "23.06.2027 L268623".
  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ISO date with optional trailing lot text.
  const isoLoose = /^(\d{4})-(\d{2})-(\d{2})(?:\s+.*)?$/.exec(raw);
  if (isoLoose) {
    const year = Number(isoLoose[1]);
    const month = Number(isoLoose[2]);
    const day = Number(isoLoose[3]);
    if (!isValidCalendarYmd(year, month, day)) return null;
    return `${isoLoose[1]}-${isoLoose[2]}-${isoLoose[3]}`;
  }

  return null;
}


/** Parse ONLY day.month.year (Bulgarian documents). Never treat as US month/day or ISO. */
export function parsePrintedExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // Reject ISO-shaped values in the printed field - those belong in expiryDate.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;

  const dmy = /^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  if (!isValidCalendarYmd(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Prefer the printed DD.MM.YYYY cell (source of truth) over model ISO,
 * which often swaps day/month (01.12 -> 2027-01-12 instead of 2027-12-01).
 */
export function resolveDocumentExpiry(
  expiryDate: string | null | undefined,
  expiryPrinted?: string | null | undefined,
): string | null {
  const fromPrinted = parsePrintedExpiry(expiryPrinted);
  if (fromPrinted) return fromPrinted;
  // Fallback only when the model failed to copy printed text.
  return parseDocumentExpiry(expiryDate);
}

function normalizeQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded >= 1 ? rounded : 1;
  }
  if (typeof value === "string") {
    const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
    if (match) {
      const n = Math.round(Number(match[0]));
      return n >= 1 ? n : 1;
    }
  }
  return 1;
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Recover rows when the model truncates mid-array (common on long tables). */
export function repairTruncatedItemsJson(raw: string): string | null {
  const itemsKey = raw.indexOf('"items"');
  if (itemsKey < 0) return null;
  const arrayStart = raw.indexOf("[", itemsKey);
  if (arrayStart < 0) return null;

  let lastCompleteObjectEnd = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) lastCompleteObjectEnd = i;
    } else if (ch === "]" && depth === 0) {
      // End of the array. We have all complete objects; reconstruct a valid
      // wrapper (the model sometimes omits the closing root brace).
      break;
    }
  }

  if (lastCompleteObjectEnd < 0) return null;
  return `{"items":${raw.slice(arrayStart, lastCompleteObjectEnd + 1)}]}`;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  if (start < 0) {
    throw new Error("OCR_PARSE_FAILED");
  }

  const slice = body.slice(start);
  const attempts = [slice];
  const end = slice.lastIndexOf("}");
  if (end > 0) attempts.push(slice.slice(0, end + 1));
  const repaired = repairTruncatedItemsJson(slice);
  if (repaired) attempts.push(repaired);

  let lastError: unknown;
  for (const candidate of attempts) {
    try {
      return tryParseJson(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  console.error(
    "document AI JSON parse failed",
    lastError instanceof Error ? lastError.message : lastError,
  );
  if (process.env.OCR_DEBUG) {
    console.error("OCR_DEBUG rawLength", body.length);
    console.error("OCR_DEBUG head", body.slice(0, 300));
    console.error("OCR_DEBUG tail", body.slice(-300));
  }
  throw new Error("OCR_PARSE_FAILED");
}

function toRows(payload: unknown): DocumentOcrRow[] {
  const parsed = rowsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("OCR_PARSE_FAILED");
  }

  const rows = parsed.data.items
    .map((item) => {
      const name = item.name?.trim() ?? "";
      const barcode = item.barcode?.trim() || null;
      const articul = item.articul?.trim() || null;
      const expiryYmd = resolveDocumentExpiry(item.expiryDate, item.expiryPrinted);
      const quantity = normalizeQuantity(item.quantity);
      return { name, barcode, articul, expiryYmd, quantity };
    })
    .filter((row) => row.name || row.barcode || row.articul || row.expiryYmd);

  return sanitizeDocumentRows(rows);
}

const SYSTEM_PROMPT = `You extract product rows from a photo of a store document / invoice / delivery note / warehouse write-off (izpisvane) / expiry list.
Documents may be in Bulgarian. Common columns:
- Articul / SKU (NOT an EAN barcode) -> "articul"
- Product name -> "name" (keep Cyrillic as-is)
- Quantity / pieces -> "quantity"
- Godnost / best-before -> expiryPrinted only
- Barcode / EAN -> "barcode" if present

Return ONLY compact valid JSON (no markdown, no extra spaces) with this shape:
{"items":[{"name":"...","barcode":null,"articul":"...","expiryPrinted":"DD.MM.YYYY","expiryDate":null,"quantity":1}]}

DATE RULES (critical - Bulgarian day.month.year):
- expiryPrinted = COPY the Godnost cell EXACTLY as printed characters, e.g. "01.12.2027" or "23.06.2027 L268623". Do not reorder digits.
- expiryDate must ALWAYS be null. The server converts DD.MM.YYYY to ISO. Never invent YYYY-MM-DD yourself.
- Example: printed 01.12.2027 -> expiryPrinted "01.12.2027", expiryDate null (means 1 December 2027 on the server).
- Example: printed 12.01.2026 -> expiryPrinted "12.01.2026", expiryDate null.
- When day and month are both <= 12, still copy day-first order as printed. Do not swap.
- Re-read each digit carefully (6 vs 8, and year last digit). Prefer the printed cell over guessing.

Other rules:
- Extract EVERY product row (do not stop early). Keep each object short.
- name = product name (keep original language / Cyrillic).
- barcode = EAN/UPC digits only if a real barcode column exists; else null. Never put Articul into barcode.
- articul = Articul / SKU if present, else null.
- Never copy a date from the row above or below. Never invent a date.
- Every field (barcode, articul, expiryPrinted, quantity) must come ONLY from that item's own printed row. Never borrow, reuse, or "fill in" a value that is actually printed on a different row, even if that row is empty or looks incomplete.
- If Godnost is blank, "1", or unreadable, set expiryPrinted to null and expiryDate to null.
- After finishing, re-check the LAST 3 rows: each name keeps its own printed date string.
- quantity = pieces if present, else 1. Ignore difference columns.
- Ignore headers, client address, totals, signatures, batch/lot unless needed for clarity.
- If a field is missing or unreadable, use null (quantity defaults to 1).

LEFTOVER / CUT-OFF TEXT (important, this is a common photo-of-a-page mistake):
- This photo may be one page of a multi-page document. Text that is truncated at the very TOP or very BOTTOM edge of the photo (a name with no visible barcode/articul/quantity/date next to it, or only 1-2 words with no table columns at all) is usually the tail end of a row that continues on a different page you cannot see.
- Do NOT turn such a cut-off fragment into its own item, and do NOT pair it with the quantity/date/barcode of the nearest full row above or below it — that data belongs to a different product.
- If you genuinely cannot tell whether a top/bottom edge line is a real, complete row, leave it out entirely rather than guessing or inventing its missing fields from a neighboring row.
- Output must be complete closable JSON even if the page is long.`;





const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Tried in order when the preferred model is busy / unavailable. Lite last = less accurate on tables. */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
];

function resolveModel(
  raw: string | undefined,
  fallback: string,
): string {
  const model = raw?.trim() ?? "";
  // Reject broken .env values like: DOCUMENT_AI_MODEL=gemini 1.5 flash
  if (!model || /\s/.test(model)) return fallback;
  return model;
}

function geminiModelsToTry(preferred: string): string[] {
  const out: string[] = [];
  const push = (model: string) => {
    if (model && !out.includes(model)) out.push(model);
  };
  push(preferred);
  for (const model of GEMINI_MODEL_FALLBACKS) push(model);
  return out;
}

function documentAiConfigured(): {
  provider: "gemini" | "openai";
  apiKey: string;
  model: string;
} | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const preferred = process.env.DOCUMENT_AI_PROVIDER?.trim().toLowerCase();

  if (preferred === "openai" && openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_OPENAI_MODEL),
    };
  }
  if (preferred === "gemini" && geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_GEMINI_MODEL),
    };
  }
  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_GEMINI_MODEL),
    };
  }
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      model: resolveModel(process.env.DOCUMENT_AI_MODEL, DEFAULT_OPENAI_MODEL),
    };
  }
  return null;
}

export function isDocumentAiConfigured(): boolean {
  return documentAiConfigured() !== null;
}

export function getDocumentAiStatus(): {
  configured: boolean;
  provider: string | null;
  model: string | null;
} {
  const config = documentAiConfigured();
  if (!config) {
    return { configured: false, provider: null, model: null };
  }
  return {
    configured: true,
    provider: config.provider,
    model: config.model,
  };
}

const PROVIDER_RETRY_DELAYS_MS = [1500, 4000];
/** High-demand 503: one short retry, then switch model (avoid ~2 min on a busy model). */
const HIGH_DEMAND_RETRY_DELAYS_MS = [1200];

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isHighDemandError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    /^OCR_PROVIDER:503:/.test(message)
  );
}

function isRetryableProviderError(message: string): boolean {
  if (isUnavailableModelError(message)) return false;
  if (message.startsWith("OCR_EMPTY:")) return false;

  const statusMatch = /^OCR_PROVIDER:(\d{3}):/.exec(message);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 429 || status === 500 || status === 502 || status === 503) {
      return true;
    }
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("overloaded") ||
    lower.includes("too many requests") ||
    lower.includes("unavailable") ||
    lower.includes("try again") ||
    lower.includes("deadline exceeded") ||
    lower.includes("internal error") ||
    lower.includes("high demand")
  );
}

async function withProviderRetries<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let lastError: Error | null = null;
  let delays = PROVIDER_RETRY_DELAYS_MS;
  const maxAttempts = Math.max(PROVIDER_RETRY_DELAYS_MS.length, HIGH_DEMAND_RETRY_DELAYS_MS.length) + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (isHighDemandError(err.message)) {
        delays = HIGH_DEMAND_RETRY_DELAYS_MS;
      }
      const canRetry =
        attempt < delays.length && isRetryableProviderError(err.message);
      if (!canRetry) throw err;
      const delay = delays[attempt] ?? delays[delays.length - 1];
      console.warn(
        `document AI: ${label} retry ${attempt + 1}/${delays.length} in ${delay}ms (${err.message})`,
      );
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("OCR_PROVIDER:Retries exhausted");
}

async function extractWithGeminiOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // gemini-2.5 / 3.x are "thinking" models: reasoning tokens count against
  // maxOutputTokens and add large latency (~2 min). For structured table OCR we
  // don't need it â€” disabling thinking makes it fast AND stops the model from
  // burning the token budget on thoughts (which truncated long tables).
  const isThinkingModel = /gemini-(?:3|2\.5)/i.test(model);

  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    maxOutputTokens: 65536,
    // With thinking off there are no "thought" parts, so forcing JSON is safe
    // and more reliable than parsing free text.
    responseMimeType: "application/json",
  };
  if (isThinkingModel) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: mime, data: base64 } },
          ],
        },
      ],
      generationConfig,
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string; status?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  } | null;

  if (!response.ok) {
    const detail =
      data?.error?.message || data?.error?.status || "OCR_PROVIDER_ERROR";
    throw new Error(`OCR_PROVIDER:${response.status}:${detail}`);
  }

  if (data?.promptFeedback?.blockReason) {
    throw new Error(`OCR_EMPTY:BLOCKED_${data.promptFeedback.blockReason}`);
  }

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => part.text && !part.thought)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!text) {
    throw new Error(`OCR_EMPTY:${candidate?.finishReason || "EMPTY"}`);
  }
  return text;
}

function isUnavailableModelError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("not_found") ||
    lower.includes("not found") ||
    lower.includes("no longer available") ||
    lower.includes("is not found")
  );
}

async function extractWithGemini(
  apiKey: string,
  preferredModel: string,
  mime: string,
  base64: string,
): Promise<string> {
  const models = geminiModelsToTry(preferredModel);
  let lastError: Error | null = null;

  for (const model of models) {
    const startedAt = Date.now();
    try {
      const text = await withProviderRetries(`gemini:${model}`, () =>
        extractWithGeminiOnce(apiKey, model, mime, base64),
      );
      console.log(
        `document AI: model "${model}" ok in ${Date.now() - startedAt}ms`,
      );
      if (model !== preferredModel) {
        console.warn(
          `document AI: preferred model "${preferredModel}" failed; used "${model}"`,
        );
      }
      return text;
    } catch (error) {
      console.warn(
        `document AI: model "${model}" failed in ${Date.now() - startedAt}ms`,
      );
      const message = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(message);
      if (
        isUnavailableModelError(message) ||
        message.startsWith("OCR_EMPTY:") ||
        isRetryableProviderError(message)
      ) {
        console.warn(
          `document AI: model "${model}" failed (${message}), trying next`,
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("OCR_PROVIDER:No Gemini model available");
}

async function extractWithOpenAI(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  const baseUrl =
    process.env.DOCUMENT_AI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all product rows from this document photo.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!response.ok) {
    throw new Error(
      `OCR_PROVIDER:${response.status}:${data?.error?.message || "OCR_PROVIDER_ERROR"}`,
    );
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OCR_EMPTY:EMPTY");
  return text;
}

export async function extractDocumentRows(
  dataUrl: string,
): Promise<DocumentOcrRow[]> {
  const config = documentAiConfigured();
  if (!config) {
    throw new Error("OCR_NOT_CONFIGURED");
  }

  const { mime, base64 } = stripDataUrl(dataUrl);
  const text =
    config.provider === "gemini"
      ? await extractWithGemini(config.apiKey, config.model, mime, base64)
      : await withProviderRetries(`openai:${config.model}`, () =>
          extractWithOpenAI(config.apiKey, config.model, mime, base64),
        );

  return toRows(extractJsonObject(text));
}

export async function extractDocumentRowsFromPath(
  imagePath: string,
): Promise<DocumentOcrRow[]> {
  const filePath = resolveLocalUploadPath(imagePath);
  if (!filePath) {
    throw new Error("INVALID_IMAGE");
  }
  const buffer = await readFile(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase() || "jpg";
  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "gif"
          ? "image/gif"
          : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  return extractDocumentRows(dataUrl);
}