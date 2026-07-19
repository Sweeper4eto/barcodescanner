import { readFile } from "node:fs/promises";
import "dotenv/config";
import { z } from "zod";
import { resolveLocalUploadPath } from "@/lib/upload";

const rowSchema = z.object({
  name: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  articul: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
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

/** Parse common EU/BG date strings into YYYY-MM-DD. */
export function parseDocumentExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/.exec(raw);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const mdy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/.exec(raw);
  if (mdy) {
    // Prefer DMY for EU docs; already handled above with same pattern.
  }

  return null;
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

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("OCR_PARSE_FAILED");
  }
  return JSON.parse(body.slice(start, end + 1));
}

function toRows(payload: unknown): DocumentOcrRow[] {
  const parsed = rowsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("OCR_PARSE_FAILED");
  }

  return parsed.data.items
    .map((item) => {
      const name = item.name?.trim() ?? "";
      const barcode = item.barcode?.trim() || null;
      const articul = item.articul?.trim() || null;
      const expiryYmd = parseDocumentExpiry(item.expiryDate);
      const quantity = normalizeQuantity(item.quantity);
      return { name, barcode, articul, expiryYmd, quantity };
    })
    .filter((row) => row.name || row.barcode || row.articul || row.expiryYmd);
}

const SYSTEM_PROMPT = `You extract product rows from a photo of a store document / invoice / delivery note / warehouse write-off (изписване) / expiry list.
Documents may be in Bulgarian. Common columns:
- Артикул = internal article/SKU (NOT an EAN barcode) → put in "articul"
- Наименование = product name → "name" (keep Cyrillic as-is)
- Заявени / Количество / Брой = quantity → "quantity"
- Годност = expiry date (DD.MM.YYYY) → "expiryDate"
- Баркод / EAN = real barcode if present → "barcode"

Return ONLY valid JSON with this shape:
{"items":[{"name":"string","barcode":"string|null","articul":"string|null","expiryDate":"YYYY-MM-DD or DD.MM.YYYY","quantity":1}]}

Rules:
- Extract EVERY product row in the table (do not stop early).
- name = product name (keep original language / Cyrillic).
- barcode = EAN/UPC digits only if a real barcode column exists; else null. Never put Артикул into barcode.
- articul = Артикул / SKU / арт. number if present, else null.
- expiryDate = Годност / best-before for that row. Prefer YYYY-MM-DD. If the cell is blank, "1", or not a date, use null.
- quantity = Заявени / pieces if present, else 1. Ignore Разлика (difference) column.
- Ignore headers, client address, totals, signatures, batch/Партида unless needed for clarity.
- If a field is missing or unreadable, use null (quantity defaults to 1).
- Do not invent barcodes or dates.`;

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Tried in order when the preferred model returns 404 / unavailable. */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.0-flash",
  "gemini-flash-latest",
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

async function extractWithGeminiOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        // Avoid forcing JSON MIME on Gemini 3.x thinking models — they often
        // return empty candidates. We still ask for JSON in the prompt.
        responseMimeType: model.includes("2.0") ? "application/json" : undefined,
      },
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
    throw new Error(`OCR_PROVIDER:${detail}`);
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
    try {
      const text = await extractWithGeminiOnce(apiKey, model, mime, base64);
      if (model !== preferredModel) {
        console.warn(
          `document AI: preferred model "${preferredModel}" failed; used "${model}"`,
        );
      }
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(message);
      if (isUnavailableModelError(message)) {
        console.warn(`document AI: model "${model}" unavailable, trying next`);
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
      temperature: 0.1,
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
      `OCR_PROVIDER:${data?.error?.message || "OCR_PROVIDER_ERROR"}`,
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
      : await extractWithOpenAI(config.apiKey, config.model, mime, base64);

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