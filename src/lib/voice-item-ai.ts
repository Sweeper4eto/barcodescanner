import { z } from "zod";
import {
  findSpokenDateInText,
  parseDocumentExpiry,
  textAfterQuantityPhrase,
} from "@/lib/expiry-parse";
import { correctGroceryTranscript } from "@/lib/voice-transcript-correct";

/**
 * Voice → inventory draft via Gemini.
 *
 * Modes (VOICE_AI_MODE):
 * - smart (default): Flash audio understanding → name / qty / date JSON
 *   (ChatGPT-like intent), then confirm on device.
 * - exact: Transcribe verbatim → deterministic parse (literal words).
 *
 * Smart still forbids swapping rare products for common foods.
 */

export type VoiceAiMode = "smart" | "exact";

const DEFAULT_VOICE_MODE: VoiceAiMode = "smart";
const DEFAULT_VOICE_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const DEFAULT_VOICE_UNDERSTAND_MODEL = "gemini-3.6-flash";
const DEFAULT_VOICE_FETCH_TIMEOUT_MS = 45_000;

const GEMINI_TRANSCRIBE_FALLBACKS = [
  "gemini-3.5-transcribe",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
];

const GEMINI_SMART_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
];

/**
 * Bias STT toward domain units / brands / rare product phrases only.
 * Do NOT list common foods (мляко, хляб…) — that swaps unusual speech.
 */
export const VOICE_CUSTOM_VOCABULARY = [
  "броя",
  "брой",
  "година",
  "швепс",
  "Schweppes",
  "ройс",
  "Roys",
  "Coca-Cola",
  "Coca Cola",
  "тунквана",
  "вафла",
  "фъстъци",
  "рибни филета",
  "кисела диня",
  "пастет",
  "слънце",
];

export type VoiceItemParseResult = {
  name: string;
  quantity: number;
  /** YYYY-MM-DD when recognized, otherwise null. */
  expiryDate: string | null;
  transcript?: string;
};

/** Exact mode — dedicated Transcribe / Flash STT. */
const TRANSCRIBE_SYSTEM = `You are a verbatim speech-to-text engine. Not a grocery assistant. Not a spell-checker. Not an autocorrect.
Output JSON only: {"transcript":"..."}
Rules:
- Write EXACTLY the words spoken, in order. Bulgarian speech → Cyrillic letters.
- Never replace speech with a more common food, brand, or “likely” phrase.
  Example: heard "кисела диня" → "кисела диня" (never "кисело мляко").
- Do not translate, invent, omit, or reorder words.
- Keep endings as spoken (кисела ≠ кисело; диня ≠ мляко).
- Keep brands/loanwords as heard (швепс, ройс, Roys, Schweppes, Coca-Cola).
- Keep numbers and dates exactly as spoken.
- Quantity: Arabic digits + броя (e.g. "10 броя"). Dates: as spoken (3ти май 2031).`;

const TRANSCRIBE_USER =
  'Transcribe the attached audio into {"transcript":"..."}. Trust only what you hear — do not invent or “fix” words.';

/**
 * Smart mode — understand inventory fields from speech (ChatGPT-like).
 * Still must not rewrite rare product names into popular foods.
 */
const SMART_SYSTEM = `You extract one retail inventory item from Bulgarian (or English) speech.
Return JSON only:
{"transcript":"...","name":"...","quantity":1,"expiryPrinted":null,"expiryIso":null}
Field rules:
- transcript = close verbatim of what was said (Cyrillic for Bulgarian).
- name = product name ONLY (no quantity, no date, no words ден/месец/година/броя).
  Keep unusual names exactly (кисела диня ≠ кисело мляко; рибни филета stays).
  Do NOT substitute a more common grocery product.
- quantity = integer pieces (from "10 броя", "десет броя", "2", etc.). Default 1.
- expiryPrinted = how the date was spoken/printed if any (e.g. "14-ти месец май 2029", "15.11.2026"), else null.
- expiryIso = YYYY-MM-DD when you can resolve the date, else null.
  Understand flexible dates: "трети май двадесет и девета година", "месец май 2029",
  "15 юни 28 ма", "май месец", day/month/year in any order after quantity.
  Month+year with no day → last day of that month (май 2029 → 2029-05-31).
- After "броя"/pieces the rest is usually the date, not part of the name.
- Brands as heard (швепс, ройс, Schweppes, Coca-Cola).`;

const SMART_USER =
  "Listen to the audio and return the inventory JSON. Prefer exact product words; understand quantity and date flexibly.";

const transcriptSchema = z.object({
  transcript: z.string().trim().min(1).max(500),
});

/** Legacy structured schema — fallback only if transcript-only fails. */
const voiceItemSchema = z.object({
  transcript: z.string().trim().max(500).optional().default(""),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  expiryPrinted: z.string().trim().max(120).nullable().optional(),
  expiryIso: z.string().trim().max(32).nullable().optional(),
});

export function isVoiceTranscribeModel(model: string): boolean {
  return /transcribe/i.test(model);
}

export function resolveVoiceAiMode(): VoiceAiMode {
  const raw = process.env.VOICE_AI_MODE?.trim().toLowerCase();
  if (raw === "exact" || raw === "verbatim" || raw === "transcribe") {
    return "exact";
  }
  if (raw === "smart" || raw === "understand") return "smart";
  return DEFAULT_VOICE_MODE;
}

function resolveGemini(): { apiKey: string; mode: VoiceAiMode } | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return { apiKey, mode: resolveVoiceAiMode() };
}

function resolveExactModel(): string {
  const raw = process.env.VOICE_AI_MODEL?.trim() || DEFAULT_VOICE_TRANSCRIBE_MODEL;
  return /\s/.test(raw) ? DEFAULT_VOICE_TRANSCRIBE_MODEL : raw;
}

function resolveSmartModel(): string {
  const raw =
    process.env.VOICE_AI_UNDERSTAND_MODEL?.trim() ||
    process.env.VOICE_AI_MODEL?.trim() ||
    DEFAULT_VOICE_UNDERSTAND_MODEL;
  // Do not use the Transcribe model for understanding — it only returns speech text.
  if (!raw || /\s/.test(raw) || isVoiceTranscribeModel(raw)) {
    return DEFAULT_VOICE_UNDERSTAND_MODEL;
  }
  return raw;
}

function voiceFetchTimeoutMs(): number {
  const raw = process.env.VOICE_AI_FETCH_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : DEFAULT_VOICE_FETCH_TIMEOUT_MS;
  if (!Number.isFinite(parsed)) return DEFAULT_VOICE_FETCH_TIMEOUT_MS;
  return Math.min(90_000, Math.max(5_000, Math.floor(parsed)));
}

export function voiceModelsToTry(
  preferred: string,
  mode: VoiceAiMode = "exact",
): string[] {
  const out: string[] = [];
  const push = (model: string) => {
    if (model && !out.includes(model)) out.push(model);
  };
  push(preferred);
  const fallbacks =
    mode === "smart" ? GEMINI_SMART_FALLBACKS : GEMINI_TRANSCRIBE_FALLBACKS;
  for (const model of fallbacks) push(model);
  return out;
}

export function isVoiceItemAiConfigured(): boolean {
  return Boolean(resolveGemini());
}

export function parseVoiceAudioDataUrl(dataUrl: string): {
  mime: string;
  base64: string;
} {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) {
    throw new Error("VOICE_INVALID_AUDIO");
  }
  const comma = trimmed.indexOf(",");
  if (comma < 5) {
    throw new Error("VOICE_INVALID_AUDIO");
  }
  const meta = trimmed.slice(5, comma);
  const payload = trimmed.slice(comma + 1);
  if (!payload || !/;base64/i.test(meta)) {
    throw new Error("VOICE_INVALID_AUDIO");
  }
  const mime = (meta.split(";")[0] || "").trim().toLowerCase();
  if (!mime) {
    throw new Error("VOICE_INVALID_AUDIO");
  }
  return { mime, base64: payload };
}

export function normalizeVoiceAudioMime(mime: string): string {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  if (base === "video/mp4" || base === "audio/mp4") return "audio/mp4";
  if (base.startsWith("audio/")) return base;
  throw new Error("VOICE_INVALID_AUDIO");
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("VOICE_PARSE_FAILED");
  }
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function coerceQuantity(value: unknown): number {
  if (value == null || value === "") return 1;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(9999, Math.round(value)));
  }
  if (typeof value === "string") {
    const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
    if (!match) return 1;
    const n = Number(match[0]);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(9999, Math.round(n)));
  }
  return 1;
}

/** STT often mangles броя — accept common lookalikes. */
const QTY_UNIT =
  "(?:броя|брой|броят|брояа|бройа|броял|бройове|количество|бр\\.?|pieces?|pcs\\.?)";

/** Cardinal words people say instead of digits before броя. */
const BG_QTY_CARDINAL: Record<string, number> = {
  един: 1,
  една: 1,
  едно: 1,
  два: 2,
  две: 2,
  три: 3,
  четири: 4,
  пет: 5,
  шест: 6,
  седем: 7,
  осем: 8,
  девет: 9,
  десет: 10,
  единадесет: 11,
  единайсет: 11,
  дванадесет: 12,
  дванайсет: 12,
  тринадесет: 13,
  тринайсет: 13,
  четиринадесет: 14,
  четиринайсет: 14,
  петнадесет: 15,
  петнайсет: 15,
  шестнадесет: 16,
  шестнайсет: 16,
  седемнадесет: 17,
  седемнайсет: 17,
  осемнадесет: 18,
  осемнайсет: 18,
  деветнадесет: 19,
  деветнайсет: 19,
  двадесет: 20,
  двайсет: 20,
  тридесет: 30,
  трийсет: 30,
  четиридесет: 40,
  петдесет: 50,
};

const BG_QTY_ONES: Record<string, number> = {
  един: 1,
  една: 1,
  едно: 1,
  два: 2,
  две: 2,
  три: 3,
  четири: 4,
  пет: 5,
  шест: 6,
  седем: 7,
  осем: 8,
  девет: 9,
};

function clampQty(n: number): number | null {
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(9999, Math.round(n));
}

function parseSpokenQtyToken(raw: string): number | null {
  const token = raw.trim().toLowerCase().replace(/,/g, ".");
  if (/^\d{1,4}$/.test(token)) return clampQty(Number(token));

  // "двадесет и пет"
  const compound =
    /^(двадесет|двайсет|тридесет|трийсет|четиридесет|петдесет)\s+и\s+(\p{L}+)$/u.exec(
      token,
    );
  if (compound) {
    const tensWord = compound[1]!;
    const ones = BG_QTY_ONES[compound[2]!];
    if (ones == null) return null;
    const tens =
      tensWord.startsWith("пет")
        ? 50
        : tensWord.startsWith("четири")
          ? 40
          : tensWord.startsWith("три")
            ? 30
            : 20;
    return clampQty(tens + ones);
  }

  return clampQty(BG_QTY_CARDINAL[token] ?? NaN);
}

/** Digits or spoken cardinal immediately before a quantity unit. */
const QTY_BEFORE_UNIT_RE = new RegExp(
  `(\\d{1,4}|(?:двадесет|двайсет|тридесет|трийсет|четиридесет|петдесет)\\s+и\\s+(?:един|една|едно|два|две|три|четири|пет|шест|седем|осем|девет)|единадесет|единайсет|дванадесет|дванайсет|тринадесет|тринайсет|четиринадесет|четиринайсет|петнадесет|петнайсет|шестнадесет|шестнайсет|седемнадесет|седемнайсет|осемнадесет|осемнайсет|деветнадесет|деветнайсет|двадесет|двайсет|тридесет|трийсет|четиридесет|петдесет|един|една|едно|два|две|три|четири|пет|шест|седем|осем|девет|десет)\\s*${QTY_UNIT}`,
  "iu",
);

/** Unit then digits: "броя 10". */
const QTY_AFTER_UNIT_RE = new RegExp(`${QTY_UNIT}\\s*(\\d{1,4})`, "iu");

/**
 * Bare count before an ordinal/numeric date when "броя" was dropped by STT:
 * "… швепс 10 3ти май …" / "… 10 15.11.2026".
 * Do NOT match day-before-month ("3 май") — that day is not quantity.
 */
const QTY_BEFORE_DATE_RE = new RegExp(
  `(?:^|\\s)(\\d{1,4})(?=\\s+(?:\\d{1,2}\\s*-?\\s*(?:ти|та|то|ми|ви)|първи|първо|втори|второ|трети|трето|четвърти|пети|пето|шести|седми|осми|девети|десети|единадесети|единайсети|дванадесети|дванайсети|тринадесети|тринайсети|четиринадесети|четиринайсети|петнадесети|петнайсети|шестнадесети|шестнайсети|седемнадесети|седемнайсети|осемнадесети|осемнайсети|деветнадесети|деветнайсети|двадесети|двайсети|тридесети|трийсети|\\d{1,2}[./-]\\d{1,2}(?:[./-]\\d{2,4})?))`,
  "iu",
);

export function extractQuantityFromTranscript(
  transcript: string,
): number | null {
  const text = transcript.trim();
  if (!text) return null;

  const beforeUnit = QTY_BEFORE_UNIT_RE.exec(text);
  if (beforeUnit?.[1]) {
    const n = parseSpokenQtyToken(beforeUnit[1]);
    if (n != null) return n;
  }

  const afterUnit = QTY_AFTER_UNIT_RE.exec(text);
  if (afterUnit?.[1]) {
    const n = clampQty(Number(afterUnit[1]));
    if (n != null) return n;
  }

  // Last resort: digit sitting right before a date phrase (броя dropped).
  const beforeDate = QTY_BEFORE_DATE_RE.exec(text);
  if (beforeDate?.[1]) {
    const n = clampQty(Number(beforeDate[1]));
    // Avoid treating calendar day as qty when it's the only number (handled by date parse).
    if (n != null && n <= 999) return n;
  }

  return null;
}

/** Shared stripper for qty phrases used by nameFromTranscript. */
function stripQuantityPhrases(text: string): {
  cleaned: string;
  qtyNumber: string | null;
} {
  let cleaned = text;
  let qtyNumber: string | null = null;

  const beforeUnit = QTY_BEFORE_UNIT_RE.exec(cleaned);
  if (beforeUnit?.[1]) {
    const n = parseSpokenQtyToken(beforeUnit[1]);
    if (n != null) qtyNumber = String(n);
    cleaned = cleaned.replace(QTY_BEFORE_UNIT_RE, " ");
  } else {
    const afterUnit = QTY_AFTER_UNIT_RE.exec(cleaned);
    if (afterUnit?.[1]) {
      qtyNumber = afterUnit[1];
      cleaned = cleaned.replace(QTY_AFTER_UNIT_RE, " ");
    } else {
      const beforeDate = QTY_BEFORE_DATE_RE.exec(cleaned);
      if (beforeDate?.[1]) {
        qtyNumber = beforeDate[1];
        cleaned = cleaned.replace(QTY_BEFORE_DATE_RE, " ");
      }
    }
  }

  // Orphan unit words left after STT noise.
  cleaned = cleaned.replace(
    /(?:^|\s)(?:броя|брой|броят|брояа|бройа|броял|бройове|количество|бр\.?|pieces?|pcs\.?)(?=\s|$)/giu,
    " ",
  );

  return { cleaned, qtyNumber };
}

const MONTH_NAMES =
  "януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември";

const DAY_WORDS =
  "първи|първо|първа|втори|второ|втора|трети|трето|трета|четвърти|четвърта|пети|пето|пета|шести|шесто|шеста|седми|седмо|седма|осми|осмо|осма|девети|девето|девета|десети|десето|десета|единадесети|единайсети|единадесета|единайсета|дванадесети|дванайсети|дванадесета|дванайсета|тринадесети|тринайсети|тринадесета|тринайсета|четиринадесети|четиринайсети|четиринадесета|четиринайсета|петнадесети|петнайсети|петнадесета|петнайсета|шестнадесети|шестнайсети|шестнадесета|шестнайсета|седемнадесети|седемнайсети|седемнадесета|седемнайсета|осемнадесети|осемнайсети|осемнадесета|осемнайсета|деветнадесети|деветнайсети|деветнадесета|деветнайсета|двадесети|двайсети|двадесета|двайсета|тридесети|трийсети|тридесета|трийсета";

const YEAR_TAIL =
  "(?:две\\s+хиляди(?:\\s+и)?\\s+)?(?:\\d{4}|двадесет\\s+и\\s+[\\p{L}]+|двайсет\\s+и\\s+[\\p{L}]+|тридесет\\s+и\\s+[\\p{L}]+|\\d{2}\\s*-?\\s*(?:та|ма|ва|ра|ти)|\\d{2})";

const DATE_FILLER_WORDS =
  "месец|месеца|месеци|ден|дена|денят|число|година|год\\.?|г\\.";

function stripDateFillers(text: string): string {
  return text
    .replace(new RegExp(`(?:^|\\s)(?:${DATE_FILLER_WORDS})(?=\\s|$)`, "giu"), " ")
    .replace(/[,;`]+/g, " ");
}

/**
 * Product name = transcript with quantity and date phrases removed.
 * After "броя" the rest is treated as the date (never product text).
 */
export function nameFromTranscript(transcript: string): string {
  const original = transcript.trim();
  let cleaned = original;
  const hadDate = Boolean(findSpokenDateInText(original));

  // Fast path: everything before the quantity phrase is the product name.
  // ("кисела диня 10 броя месец май 2029" → "кисела диня")
  const afterQty = textAfterQuantityPhrase(original);
  if (afterQty != null) {
    const qtyAt = original.length - afterQty.length;
    // Walk back over the quantity phrase itself.
    const beforeTail = original.slice(0, Math.max(0, qtyAt)).trim();
    const cut = beforeTail.replace(
      new RegExp(
        `(?:\\d{1,4}|[\\p{L}\\s]+?)\\s*(?:броя|брой|броят|бр\\.?|количество|pieces?|pcs\\.?)\\s*$`,
        "iu",
      ),
      "",
    );
    const product = stripDateFillers(cut)
      .replace(/\s+/g, " ")
      .trim();
    if (product) return product.slice(0, 200);
  }

  // 1) Quantity phrases ("10 броя" / "десет броя" / "броя 10").
  const strippedQty = stripQuantityPhrases(cleaned);
  cleaned = stripDateFillers(strippedQty.cleaned);
  const qtyNumber = strippedQty.qtyNumber;

  // 2) Full spoken / numeric date phrases (with optional ден/месец already stripped).
  cleaned = cleaned.replace(
    new RegExp(
      `(\\d{1,2}\\s*-?\\s*(?:ти|та|то|ми|ви|ма|ва|ра)|${DAY_WORDS}|двадесет\\s+и\\s+[\\p{L}]+|двайсет\\s+и\\s+[\\p{L}]+|тридесет\\s+и\\s+[\\p{L}]+)\\s+(${MONTH_NAMES})\\s+${YEAR_TAIL}(?:\\s+(?:година|год\\.?))?`,
      "giu",
    ),
    " ",
  );
  cleaned = cleaned.replace(
    new RegExp(
      `(?:^|\\s)\\d{1,2}\\s+(${MONTH_NAMES})\\s+${YEAR_TAIL}(?:\\s+(?:година|год\\.?))?`,
      "giu",
    ),
    " ",
  );
  cleaned = cleaned.replace(
    new RegExp(
      `(${MONTH_NAMES})\\s+${YEAR_TAIL}(?:\\s+(?:година|год\\.?))?`,
      "giu",
    ),
    " ",
  );
  cleaned = cleaned.replace(/\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}/g, " ");
  cleaned = cleaned.replace(/\d{1,2}[./\-]\d{2,4}/g, " ");
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}/g, " ");

  // 3) Leftover date crumbs.
  cleaned = cleaned.replace(
    new RegExp(`(?:^|\\s)(?:${DAY_WORDS})(?=\\s|$)`, "giu"),
    " ",
  );
  cleaned = cleaned.replace(
    /(?:^|\s)\d{1,2}\s*-?\s*(?:ти|та|то|ми|ви|ма|ва|ра)(?=\s|$)/giu,
    " ",
  );
  cleaned = cleaned.replace(
    new RegExp(`(?:^|\\s)\\d{1,2}(?=\\s+(?:${MONTH_NAMES})(?:\\s|$))`, "giu"),
    " ",
  );
  cleaned = cleaned.replace(
    new RegExp(`(?:^|\\s)(?:${MONTH_NAMES})(?=\\s|$)`, "giu"),
    " ",
  );
  cleaned = cleaned.replace(/(?:^|\s)20\d{2}(?=\s|$)/g, " ");
  cleaned = cleaned.replace(
    /(?:^|\s)(?:две\s+хиляди(?:\s+и)?\s+)?(?:двадесет|двайсет|тридесет|трийсет)\s+и\s+[\p{L}]+(?=\s|$)/giu,
    " ",
  );
  cleaned = cleaned.replace(
    /(?:^|\s)\d{2}\s*-?\s*(?:та|ма|ва|ра|ти)(?=\s|$)/giu,
    " ",
  );
  cleaned = stripDateFillers(cleaned);

  // 4) Bare quantity number leftover.
  if (qtyNumber) {
    cleaned = cleaned.replace(
      new RegExp(`(?:^|\\s)${qtyNumber}(?=\\s|$)`, "g"),
      " ",
    );
  } else if (hadDate) {
    cleaned = cleaned.replace(
      /(?:^|\s)\d{1,3}(?!\s*(?:г|g|мл|ml|кг|kg|л|l|%))(?=\s|$)/giu,
      " ",
    );
  }

  // 5) Filler words.
  cleaned = cleaned.replace(
    /(?:^|\s)(?:искам|добавя|добавям|моля|артикул)(?=\s|$)/giu,
    " ",
  );

  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 200);
}

/** Build the inventory draft only from a transcript string. */
export function voiceItemFromTranscript(
  transcript: string,
): VoiceItemParseResult {
  const text = correctGroceryTranscript(transcript.trim());
  if (!text) throw new Error("VOICE_PARSE_FAILED");

  const expiryDate = findSpokenDateInText(text);
  const quantity = extractQuantityFromTranscript(text) ?? 1;
  let name = nameFromTranscript(text);
  if (!name) {
    // Last resort: use full transcript rather than inventing a product.
    name = text.slice(0, 200);
  }

  return {
    name,
    quantity,
    expiryDate,
    transcript: text,
  };
}

/**
 * Merge smart-model JSON with deterministic transcript parsing.
 * Prefer model understanding for fields, fill gaps from transcript rules.
 */
export function voiceItemFromSmartDraft(draft: {
  name: string;
  quantity: number;
  expiryPrinted?: string | null;
  expiryIso?: string | null;
  transcript?: string | null;
}): VoiceItemParseResult {
  const transcript = correctGroceryTranscript(
    (draft.transcript ?? "").trim(),
  );
  let fromSpeech: VoiceItemParseResult | null = null;
  if (transcript) {
    try {
      fromSpeech = voiceItemFromTranscript(transcript);
    } catch {
      fromSpeech = null;
    }
  }

  let name = (draft.name ?? "").trim();
  if (name) {
    // Drop qty/date crumbs the model left in name.
    name = nameFromTranscript(name) || name;
  }
  if (!name && fromSpeech?.name) name = fromSpeech.name;
  if (!name && transcript) {
    name = nameFromTranscript(transcript) || transcript.slice(0, 200);
  }
  name = name.slice(0, 200) || "артикул";

  const modelQty =
    draft.quantity >= 1 && draft.quantity <= 9999
      ? Math.round(draft.quantity)
      : null;
  const speechQty =
    fromSpeech?.quantity ??
    (transcript ? extractQuantityFromTranscript(transcript) : null);
  // Model often defaults to 1; trust transcript when it found an explicit qty.
  const quantity =
    modelQty != null && !(modelQty === 1 && speechQty != null && speechQty > 1)
      ? modelQty
      : (speechQty ?? modelQty ?? 1);

  const expiryDate =
    parseDocumentExpiry(draft.expiryIso) ??
    parseDocumentExpiry(draft.expiryPrinted) ??
    findSpokenDateInText(draft.expiryPrinted ?? "") ??
    fromSpeech?.expiryDate ??
    (transcript ? findSpokenDateInText(transcript) : null);

  return {
    name,
    quantity,
    expiryDate,
    transcript: transcript || fromSpeech?.transcript,
  };
}

/**
 * @deprecated Prefer voiceItemFromTranscript / voiceItemFromSmartDraft.
 * Kept for tests / fallback when transcript-only response is missing.
 */
export function refineVoiceItemFromTranscript(
  draft: {
    name: string;
    quantity: number;
    expiryPrinted?: string | null;
    expiryIso?: string | null;
    transcript?: string | null;
  },
): VoiceItemParseResult {
  const transcript = (draft.transcript ?? "").trim();
  if (transcript) {
    return voiceItemFromTranscript(transcript);
  }

  const expiryDate =
    findSpokenDateInText(draft.expiryPrinted ?? "") ??
    parseDocumentExpiry(draft.expiryIso) ??
    parseDocumentExpiry(draft.expiryPrinted) ??
    null;

  return {
    name: draft.name.trim().slice(0, 200) || "артикул",
    quantity: draft.quantity,
    expiryDate,
  };
}

function normalizeModelObject(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  const name =
    asTrimmedString(obj.name) ??
    asTrimmedString(obj.product) ??
    asTrimmedString(obj.productName) ??
    asTrimmedString(obj.item) ??
    asTrimmedString(obj.title);
  return {
    transcript:
      asTrimmedString(obj.transcript) ??
      asTrimmedString(obj.speech) ??
      asTrimmedString(obj.text) ??
      "",
    name,
    quantity: coerceQuantity(obj.quantity ?? obj.qty ?? obj.count),
    expiryPrinted:
      asTrimmedString(obj.expiryPrinted) ??
      asTrimmedString(obj.expiry) ??
      asTrimmedString(obj.date) ??
      null,
    expiryIso:
      asTrimmedString(obj.expiryIso) ??
      asTrimmedString(obj.expiryDate) ??
      null,
  };
}

type GeminiGenerateResponse = {
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
        audioTranscription?: {
          text?: string;
          words?: Array<{ word?: string }>;
        };
      }>;
    };
  }>;
};

/** Exported for tests — Transcribe uses audioTranscription.text. */
export function textFromGeminiResponse(
  data: GeminiGenerateResponse | null,
): string {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  // gemini-3.5-transcribe returns the transcript here (not part.text).
  const fromAudioTranscription = parts
    .map((part) => part.audioTranscription?.text?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromAudioTranscription) return fromAudioTranscription;

  const text = parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (text) return text;

  const words = parts
    .flatMap((part) => part.audioTranscription?.words ?? [])
    .map((w) => w.word?.trim() ?? "")
    .filter(Boolean);
  if (words.length) return words.join(" ");

  throw new Error(`VOICE_EMPTY:${candidate?.finishReason || "EMPTY"}`);
}

async function postGeminiGenerate(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timeoutMs = voiceFetchTimeoutMs();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("VOICE_PROVIDER_TIMEOUT");
  }

  const data = (await response.json().catch(() => null)) as GeminiGenerateResponse | null;

  if (!response.ok) {
    const detail = data?.error?.message || "VOICE_PROVIDER_ERROR";
    throw new Error(`VOICE_PROVIDER:${response.status}:${detail}`);
  }

  if (data?.promptFeedback?.blockReason) {
    throw new Error(`VOICE_EMPTY:BLOCKED_${data.promptFeedback.blockReason}`);
  }

  return textFromGeminiResponse(data);
}

/** Dedicated ASR model — language hint + custom vocab, no inventing prompt. */
async function callGeminiTranscribeOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  return postGeminiGenerate(apiKey, model, {
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: mime, data: base64 } }],
      },
    ],
    generationConfig: {
      audioTranscriptionConfig: {
        languageCodes: ["bg-BG"],
        mode: "VERBATIM",
        customVocabulary: VOICE_CUSTOM_VOCABULARY,
      },
    },
  });
}

/** Flash / general models — prompt-based STT fallback (exact mode). */
async function callGeminiFlashSttOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  const isGemini3 = /gemini-3/i.test(model);
  const isGemini25 = /gemini-2\.5/i.test(model);
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
    temperature: 0,
  };
  if (isGemini25) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else if (isGemini3) {
    generationConfig.thinkingConfig = { thinkingLevel: "low" };
  }

  return postGeminiGenerate(apiKey, model, {
    systemInstruction: { parts: [{ text: TRANSCRIBE_SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIBE_USER },
          { inlineData: { mimeType: mime, data: base64 } },
        ],
      },
    ],
    generationConfig,
  });
}

/** Smart understand — high thinking, structured inventory JSON. */
async function callGeminiSmartOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
): Promise<string> {
  if (isVoiceTranscribeModel(model)) {
    throw new Error("VOICE_PROVIDER:400:transcribe-not-for-smart");
  }
  const isGemini3 = /gemini-3/i.test(model);
  const isGemini25 = /gemini-2\.5/i.test(model);
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 2048,
    responseMimeType: "application/json",
    temperature: 0.2,
  };
  if (isGemini25) {
    generationConfig.thinkingConfig = { thinkingBudget: 8192 };
  } else if (isGemini3) {
    generationConfig.thinkingConfig = { thinkingLevel: "high" };
  }

  return postGeminiGenerate(apiKey, model, {
    systemInstruction: { parts: [{ text: SMART_SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: SMART_USER },
          { inlineData: { mimeType: mime, data: base64 } },
        ],
      },
    ],
    generationConfig,
  });
}

async function callGeminiAudioOnce(
  apiKey: string,
  model: string,
  mime: string,
  base64: string,
  mode: VoiceAiMode,
): Promise<string> {
  if (mode === "smart") {
    return callGeminiSmartOnce(apiKey, model, mime, base64);
  }
  if (isVoiceTranscribeModel(model)) {
    return callGeminiTranscribeOnce(apiKey, model, mime, base64);
  }
  return callGeminiFlashSttOnce(apiKey, model, mime, base64);
}

async function callGeminiAudio(
  apiKey: string,
  preferredModel: string,
  mime: string,
  base64: string,
  mode: VoiceAiMode,
): Promise<string> {
  const models = voiceModelsToTry(preferredModel, mode);
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await callGeminiAudioOnce(apiKey, model, mime, base64, mode);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const message = err.message;
      const retryable =
        message === "VOICE_PROVIDER_TIMEOUT" ||
        message.startsWith("VOICE_EMPTY:") ||
        /^VOICE_PROVIDER:4\d\d:/.test(message) ||
        /^VOICE_PROVIDER:5\d\d:/.test(message);
      if (!retryable || model === models[models.length - 1]) {
        throw err;
      }
      console.warn(`voice AI: ${model} failed (${message}); trying next model`);
    }
  }

  throw lastError ?? new Error("VOICE_PARSE_FAILED");
}

/** Accept plain Transcribe text or legacy JSON {"transcript":"..."}. */
export function transcriptFromModelText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error("VOICE_PARSE_FAILED");

  // gemini-3.5-transcribe returns plain transcript text.
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed.replace(/^["']|["']$/g, "").trim().slice(0, 500);
  }

  const obj = extractJsonObject(trimmed);
  if (typeof obj === "string" && obj.trim()) return obj.trim().slice(0, 500);
  const parsed = transcriptSchema.safeParse(obj);
  if (parsed.success) return parsed.data.transcript;
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const t =
      asTrimmedString((obj as Record<string, unknown>).transcript) ??
      asTrimmedString((obj as Record<string, unknown>).text) ??
      asTrimmedString((obj as Record<string, unknown>).speech);
    if (t) return t.slice(0, 500);
  }
  // Structured JSON without a speech field (legacy name/qty payload).
  throw new Error("VOICE_PARSE_FAILED");
}

/** Turn model JSON text into a draft item (exported for tests / fallback). */
export function voiceItemFromModelText(rawText: string): VoiceItemParseResult {
  // Structured smart payload (has name) — prefer understanding merge.
  try {
    const parsed = voiceItemSchema.safeParse(
      normalizeModelObject(extractJsonObject(rawText)),
    );
    if (parsed.success && parsed.data.name.trim()) {
      return voiceItemFromSmartDraft({
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        expiryPrinted: parsed.data.expiryPrinted,
        expiryIso: parsed.data.expiryIso,
        transcript: parsed.data.transcript,
      });
    }
  } catch {
    /* try transcript-only */
  }

  // Prefer transcript-only payloads (exact STT).
  try {
    const transcript = transcriptFromModelText(rawText);
    return voiceItemFromTranscript(transcript);
  } catch {
    /* fall through */
  }

  throw new Error("VOICE_PARSE_FAILED");
}

/**
 * Choose the final transcript. Gemini audio STT always wins when present —
 * browser SpeechRecognition for bg-BG often “autocorrects” into common foods
 * (e.g. кисела диня → кисело мляко). Client text is only a last-resort fallback.
 */
export function pickTranscript(
  clientTranscript: string | undefined,
  geminiTranscript: string | undefined,
): string {
  const gemini = geminiTranscript?.trim() ?? "";
  if (gemini.length >= 1) return gemini;
  const client = clientTranscript?.trim() ?? "";
  if (client.length >= 1) return client;
  throw new Error("VOICE_PARSE_FAILED");
}

async function parseVoiceExactFromAudio(
  apiKey: string,
  mime: string,
  base64: string,
  clientTranscript: string,
): Promise<VoiceItemParseResult> {
  let geminiTranscript = "";
  try {
    const rawText = await callGeminiAudio(
      apiKey,
      resolveExactModel(),
      mime,
      base64,
      "exact",
    );
    geminiTranscript = transcriptFromModelText(rawText);
  } catch (error) {
    if (!clientTranscript) throw error;
    console.warn(
      "voice AI: exact STT failed; falling back to on-device transcript",
      error instanceof Error ? error.message : error,
    );
  }
  return voiceItemFromTranscript(
    pickTranscript(clientTranscript, geminiTranscript),
  );
}

/**
 * Parse spoken audio into a draft item.
 * Default: smart understand (Flash + thinking). Set VOICE_AI_MODE=exact for verbatim.
 * Optional `clientTranscript` is an untrusted on-device hint only (never primary).
 */
export async function parseVoiceItemFromDataUrl(
  dataUrl: string,
  clientTranscript?: string,
): Promise<VoiceItemParseResult> {
  const gemini = resolveGemini();
  if (!gemini) throw new Error("VOICE_NOT_CONFIGURED");

  const { mime, base64 } = parseVoiceAudioDataUrl(dataUrl);
  const audioMime = normalizeVoiceAudioMime(mime);
  if (base64.length > 5_500_000) {
    throw new Error("VOICE_AUDIO_TOO_LARGE");
  }

  const client = clientTranscript?.trim() ?? "";

  if (gemini.mode === "smart") {
    try {
      const rawText = await callGeminiAudio(
        gemini.apiKey,
        resolveSmartModel(),
        audioMime,
        base64,
        "smart",
      );
      return voiceItemFromModelText(rawText);
    } catch (error) {
      console.warn(
        "voice AI: smart understand failed; falling back to exact STT",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return parseVoiceExactFromAudio(gemini.apiKey, audioMime, base64, client);
}
