/**
 * Shared expiry date parsing for document OCR and voice add.
 * Month+year without a day → last calendar day of that month
 * (e.g. 12.26 / 12.2026 / 12/26 → 2026-12-31).
 * Also understands spoken BG/EN phrases (e.g. "трети май 2030 година").
 */

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

function normalizeYear(year: number): number {
  if (year < 100) return year + 2000;
  return year;
}

/** Last day of month as YYYY-MM-DD, or null if month/year invalid. */
export function endOfMonthYmd(year: number, month: number): string | null {
  const y = normalizeYear(year);
  if (month < 1 || month > 12) return null;
  if (y < 2000 || y > 2100) return null;
  // Day 0 of next month = last day of `month` (1-based).
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  if (!isValidCalendarYmd(y, month, lastDay)) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function formatYmd(year: number, month: number, day: number): string | null {
  const y = normalizeYear(year);
  if (!isValidCalendarYmd(y, month, day)) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Month+year only (no day) → end of that month.
 * Accepts: 12.2026, 12.26, 12/26, 12-2026, 2026-12, and trailing junk.
 */
export function parseMonthYearExpiry(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // ISO month: 2026-12 or 2026-12 …
  const isoMonth = /^(\d{4})-(\d{1,2})(?:\s+.*)?$/.exec(raw);
  if (isoMonth) {
    return endOfMonthYmd(Number(isoMonth[1]), Number(isoMonth[2]));
  }

  // Month.year / Month/year / Month-year (2- or 4-digit year).
  // Anchored so full day.month.year (three groups) does not match.
  const my = /^(\d{1,2})[./\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (!my) return null;

  const month = Number(my[1]);
  const year = Number(my[2]);
  return endOfMonthYmd(year, month);
}

const BG_MONTHS: Record<string, number> = {
  януари: 1,
  февруари: 2,
  март: 3,
  април: 4,
  май: 5,
  юни: 6,
  юли: 7,
  август: 8,
  септември: 9,
  октомври: 10,
  ноември: 11,
  декември: 12,
};

const EN_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Bulgarian ordinal / day words → 1–31 (masc + fem — STT mixes genders). */
const BG_DAYS: Record<string, number> = {
  първи: 1,
  първо: 1,
  първа: 1,
  втори: 2,
  второ: 2,
  втора: 2,
  трети: 3,
  трето: 3,
  трета: 3,
  четвърти: 4,
  четвърта: 4,
  пети: 5,
  пето: 5,
  пета: 5,
  шести: 6,
  шесто: 6,
  шеста: 6,
  седми: 7,
  седмо: 7,
  седма: 7,
  осми: 8,
  осмо: 8,
  осма: 8,
  девети: 9,
  девето: 9,
  девета: 9,
  десети: 10,
  десето: 10,
  десета: 10,
  единадесети: 11,
  единайсети: 11,
  единадесето: 11,
  единайсето: 11,
  дванадесети: 12,
  дванайсети: 12,
  дванадесето: 12,
  дванайсето: 12,
  тринадесети: 13,
  тринайсети: 13,
  тринадесето: 13,
  тринайсето: 13,
  четиринадесети: 14,
  четиринайсети: 14,
  петнадесети: 15,
  петнайсети: 15,
  шестнадесети: 16,
  шестнайсети: 16,
  седемнадесети: 17,
  седемнайсети: 17,
  осемнадесети: 18,
  осемнайсети: 18,
  деветнадесети: 19,
  деветнайсети: 19,
  двадесети: 20,
  двайсети: 20,
  двадесето: 20,
  двайсето: 20,
  тридесети: 30,
  трийсети: 30,
  тридесето: 30,
  трийсето: 30,
};

const EN_ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
  thirtyfirst: 31,
  "thirty-first": 31,
};

/**
 * Feminine ordinals for years (година is feminine):
 * "двадесет и пета" / "25-та" → 2025.
 */
const BG_YEAR_FEM: Record<string, number> = {
  първа: 1,
  втора: 2,
  трета: 3,
  четвърта: 4,
  пета: 5,
  шеста: 6,
  седма: 7,
  осма: 8,
  девета: 9,
  десета: 10,
  единадесета: 11,
  единайсета: 11,
  дванадесета: 12,
  дванайсета: 12,
  тринадесета: 13,
  тринайсета: 13,
  четиринадесета: 14,
  четиринайсета: 14,
  петнадесета: 15,
  петнайсета: 15,
  шестнадесета: 16,
  шестнайсета: 16,
  седемнадесета: 17,
  седемнайсета: 17,
  осемнадесета: 18,
  осемнайсета: 18,
  деветнадесета: 19,
  деветнайсета: 19,
  двадесета: 20,
  двайсета: 20,
  тридесета: 30,
  трийсета: 30,
};

function normalizeSpoken(value: string): string {
  // Note: JS \b is ASCII-only — do not use it with Cyrillic tokens.
  return value
    .trim()
    .toLowerCase()
    .replace(/[„“"'`,;]+/g, " ")
    .replace(/\s+/g, " ")
    // "две хиляди (и) двадесет и пета" → "двадесет и пета"
    .replace(/(^|\s)две\s+хиляди(?:\s+и)?(\s|$)/giu, " ")
    // Date role words: "14-ти месец май 2029 година" → "14-ти май 2029"
    .replace(/(^|\s)(?:месец|месеца|месеци)(\s|$)/giu, " ")
    .replace(/(^|\s)(?:ден|дена|денят|число)(\s|$)/giu, " ")
    .replace(/(^|\s)година(\s|$)/giu, " ")
    .replace(/(^|\s)год\.?(\s|$)/giu, " ")
    .replace(/(^|\s)г\.(\s|$)/giu, " ")
    .replace(/\byear\b/gi, " ")
    .replace(/\bmonth\b/gi, " ")
    .replace(/\bday\b/gi, " ")
    // "май месец" already handled; "на 3 май" → "3 май"
    .replace(/(^|\s)на(?=\s+\d)/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map 0–99 (or full 20xx) into a calendar year 2000–2100. */
function yearFromShort(n: number): number | null {
  if (n >= 2000 && n <= 2100) return n;
  if (n >= 0 && n <= 99) {
    const y = 2000 + n;
    return y <= 2100 ? y : null;
  }
  return null;
}

function lookupMonth(token: string): number | null {
  return BG_MONTHS[token] ?? EN_MONTHS[token] ?? null;
}

function parseBgCompoundDay(text: string): { day: number; rest: string } | null {
  // "двадесет и трети …" / "двайсет и първи …" / "тридесет и първи …"
  const compound =
    /^(двадесет|двайсет|тридесет|трийсет)\s+и\s+(първи|първо|втори|второ|трети|трето|четвърти|пети|пето|шести|седми|осми|девети|десети)(?:\s+|$)(.*)$/u.exec(
      text,
    );
  if (!compound) return null;
  const tens = compound[1]!.startsWith("три") ? 30 : 20;
  const ones = BG_DAYS[compound[2]!] ?? 0;
  if (!ones) return null;
  return { day: tens + ones, rest: compound[3]!.trim() };
}

function parseDayToken(
  text: string,
): { day: number; rest: string } | null {
  const compound = parseBgCompoundDay(text);
  if (compound) return compound;

  // "3ти" / "3-ти" / "3 ти" (Bulgarian numeric ordinal)
  const bgNumericOrd =
    /^(\d{1,2})\s*-?\s*(?:ти|та|то|ми|ви|ия)(?:\s+|$)(.*)$/u.exec(text);
  if (bgNumericOrd) {
    return {
      day: Number(bgNumericOrd[1]),
      rest: bgNumericOrd[2]!.trim(),
    };
  }

  const numeric = /^(\d{1,2})(?:-?(?:st|nd|rd|th))?(?:\s+|$)(.*)$/u.exec(text);
  if (numeric) {
    return { day: Number(numeric[1]), rest: numeric[2]!.trim() };
  }

  // \p{L} — Cyrillic-safe (JS \b is ASCII-only and breaks "трети …").
  const word = /^([\p{L}\-]+)(?:\s+|$)(.*)$/u.exec(text);
  if (!word) return null;
  const token = word[1]!;
  const day = BG_DAYS[token] ?? EN_ORDINALS[token] ?? null;
  if (day == null) return null;
  return { day, rest: word[2]!.trim() };
}

const MONTH_ALT =
  "януари|февруари|март|април|май|юни|юли|август|септември|октомври|ноември|декември|january|february|march|april|may|june|july|august|september|october|november|december";

/** Year fragment used in embedded spoken-date regexes. */
const YEAR_EMBED =
  "(?:\\d{4}|\\d{2}\\s*-?\\s*(?:та|ма|ва|ра|ти)|двадесет\\s+и\\s+[\\p{L}]+|двайсет\\s+и\\s+[\\p{L}]+|тридесет\\s+и\\s+[\\p{L}]+|[\\p{L}]+)";

/**
 * After "броя" / "pieces" the rest is almost always the expiry date.
 */
export function textAfterQuantityPhrase(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const match =
    /(?:\d{1,4}|(?:десет|едина(?:де)?сет|двана(?:де)?сет|трина(?:де)?сет|четирина(?:де)?сет|петна(?:де)?сет|шестна(?:де)?сет|седемна(?:де)?сет|осемна(?:де)?сет|деветна(?:де)?сет|двадесет(?:\s+и\s+[\p{L}]+)?|двайсет(?:\s+и\s+[\p{L}]+)?|тридесет(?:\s+и\s+[\p{L}]+)?|един|една|едно|два|две|три|четири|пет|шест|седем|осем|девет))\s*(?:броя|брой|броят|бр\.?|количество|pieces?|pcs\.?)\s+/iu.exec(
      raw,
    ) ??
    /(?:броя|брой|бр\.?|pieces?|pcs\.?)\s+(\d{1,4})\s+/iu.exec(raw);
  if (!match || match.index == null) return null;
  const tail = raw.slice(match.index + match[0].length).trim();
  return tail || null;
}

function findSpokenDateInNormalized(text: string): string | null {
  if (!text) return null;

  // Numeric date embedded: "… 15.11.2026 …"
  const numericEmbedded =
    /(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})/.exec(text) ??
    /(\d{1,2}[./\-]\d{2,4})/.exec(text);
  if (numericEmbedded) {
    const hit = parseDocumentExpiry(numericEmbedded[1]);
    if (hit) return hit;
  }

  // Day + month + year somewhere in the string.
  const embedded = new RegExp(
    `(\\d{1,2}\\s*-?\\s*(?:ти|та|то|ми|ви|ма|ва|ра)|\\d{1,2}|[\\p{L}]+)\\s+(${MONTH_ALT})\\s+(${YEAR_EMBED})`,
    "iu",
  ).exec(text);
  if (embedded) {
    const phrase = `${embedded[1]} ${embedded[2]} ${embedded[3]}`;
    const hit = parseSpokenExpiry(phrase);
    if (hit) return hit;
  }

  // Month + year only — but NOT if a day-like token sits right before the month.
  const monthYear = new RegExp(
    `(${MONTH_ALT})\\s+(${YEAR_EMBED})`,
    "iu",
  ).exec(text);
  if (monthYear && monthYear.index != null) {
    const before = text.slice(0, monthYear.index).trim();
    const prev = before.split(/\s+/).filter(Boolean).pop() ?? "";
    const looksLikeDay =
      Boolean(prev) &&
      (BG_DAYS[prev] != null ||
        EN_ORDINALS[prev] != null ||
        /^\d{1,2}(?:-?(?:ти|та|то|ми|ви|ма|ва|ра|st|nd|rd|th))?$/u.test(prev));
    if (!looksLikeDay) {
      const hit = parseSpokenExpiry(`${monthYear[1]} ${monthYear[2]}`);
      if (hit) return hit;
    } else {
      const retry = parseSpokenExpiry(
        `${prev} ${monthYear[1]} ${monthYear[2]}`,
      );
      if (retry) return retry;
    }
  }

  return null;
}

/**
 * Find a spoken/numeric date inside a longer phrase
 * (e.g. "тунквана вафла … 3ти май 2031 година").
 * Prefers the tail after "броя" — that is almost always the date.
 */
export function findSpokenDateInText(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const afterQty = textAfterQuantityPhrase(value);
  if (afterQty) {
    const fromTail =
      parseSpokenExpiry(afterQty) ??
      parseDocumentExpiry(afterQty) ??
      findSpokenDateInNormalized(normalizeSpoken(afterQty));
    if (fromTail) return fromTail;
  }

  const full = parseSpokenExpiry(value) ?? parseDocumentExpiry(value);
  if (full) return full;

  const text = normalizeSpoken(value);
  if (!text) return null;
  return findSpokenDateInNormalized(text);
}

/**
 * Spoken / short year at the start of `text`.
 * "2025", "25", "25-та", "двадесет и пета" → 2025.
 */
export function parseSpokenYearToken(
  text: string,
): { year: number; rest: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // "25-та" / "28-ма" / "21-ва" / "22-ра" / "28 ма" (година already stripped)
  const ta =
    /^(\d{2})\s*-?\s*(?:та|ма|ва|ра|ти)(?:\s+|$)(.*)$/u.exec(trimmed);
  if (ta) {
    const year = yearFromShort(Number(ta[1]));
    if (year != null) return { year, rest: ta[2]!.trim() };
  }

  // Plain number year: 2025 or 25 (2-digit only when clearly a year tail)
  const num = /^(\d{2,4})(?:\s+|$)(.*)$/u.exec(trimmed);
  if (num) {
    const raw = Number(num[1]);
    // Prefer 4-digit; allow 2-digit 20–99 as 2020–2099 (not days 01–19 alone).
    if (num[1]!.length === 4 || (num[1]!.length === 2 && raw >= 20)) {
      const year = yearFromShort(raw);
      if (year != null) return { year, rest: num[2]!.trim() };
    }
  }

  // "двадесет и пета/пети" — STT often mixes fem year vs masc ordinal endings.
  const compound =
    /^(двадесет|двайсет|тридесет|трийсет)\s+и\s+(първа|първи|първо|втора|втори|второ|трета|трети|трето|четвърта|четвърти|пета|пети|пето|шеста|шести|шесто|седма|седми|седмо|осма|осми|осмо|девета|девети|девето|десета|десети|десето)(?:\s+|$)(.*)$/u.exec(
      trimmed,
    );
  if (compound) {
    const tens = compound[1]!.startsWith("три") ? 30 : 20;
    const onesWord = compound[2]!;
    const ones =
      BG_YEAR_FEM[onesWord] ??
      BG_DAYS[onesWord] ??
      0;
    if (ones) {
      const year = yearFromShort(tens + ones);
      if (year != null) return { year, rest: compound[3]!.trim() };
    }
  }

  // Single feminine year word: "пета", "двадесета", "петнайсета"
  const word = /^([\p{L}\-]+)(?:\s+|$)(.*)$/u.exec(trimmed);
  if (word) {
    const n = BG_YEAR_FEM[word[1]!];
    if (n != null) {
      const year = yearFromShort(n);
      if (year != null) return { year, rest: word[2]!.trim() };
    }
  }

  return null;
}

/**
 * Spoken BG/EN dates, e.g.:
 * - "трети май 2030 година" → 2030-05-03
 * - "14-ти месец май 2029 година" → 2029-05-14
 * - "15 юни 28 ма" → 2028-06-15
 * - "трети май двадесет и пета" / "3 май 25-та" → 2025-05-03
 * - "май месец 2030" / "май двадесет и шеста" → end of that month
 * - "двадесет и пета" / "25-та" alone → 2025-12-31 (end of year)
 * - "third of May 2030" / "May 3 2030"
 */
export function parseSpokenExpiry(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  let text = normalizeSpoken(value);
  if (!text) return null;

  // "third of may 2030" / "3rd of may 2030"
  text = text.replace(/\b(\d{1,2}|[a-zа-яёъью\-]+)\s+of\s+/u, "$1 ");

  // English "may 3 2030" / "may 3rd, 2030"
  const enMonthFirst =
    /^([a-z]+)\s+(\d{1,2})(?:-?(?:st|nd|rd|th))?,?\s+(\d{2,4})\b/u.exec(text);
  if (enMonthFirst) {
    const month = EN_MONTHS[enMonthFirst[1]!];
    if (month) {
      const year = yearFromShort(Number(enMonthFirst[3]));
      if (year != null) {
        return formatYmd(year, month, Number(enMonthFirst[2]));
      }
    }
  }

  // Day + month name + year: "трети май двадесет и пета", "3 май 25-та", "15 юни 28 ма"
  const withDay = parseDayToken(text);
  if (withDay) {
    const monthMatch = /^([\p{L}]+)(?:\s+|$)(.*)$/u.exec(withDay.rest);
    if (monthMatch) {
      const month = lookupMonth(monthMatch[1]!);
      if (month) {
        const yearTok = parseSpokenYearToken(monthMatch[2]!);
        if (yearTok) {
          return formatYmd(yearTok.year, month, withDay.day);
        }
        // Day + month, no year → end of that month (rare voice case)
        if (!monthMatch[2]!.trim()) {
          return null;
        }
      }
    }
  }

  // Month name + year only: "май 2030", "май месец двадесет и девета" → end of month
  const monthOnly = /^([\p{L}]+)(?:\s+|$)(.*)$/u.exec(text);
  if (monthOnly) {
    const month = lookupMonth(monthOnly[1]!);
    if (month) {
      const yearTok = parseSpokenYearToken(monthOnly[2]!);
      if (yearTok) {
        return endOfMonthYmd(yearTok.year, month);
      }
      // Month alone with no year — not enough
    }
  }

  // Year only: "двадесет и пета" / "25-та" / "28 ма" → 31 Dec of that year
  const yearOnly = parseSpokenYearToken(text);
  if (yearOnly && !yearOnly.rest) {
    return endOfMonthYmd(yearOnly.year, 12);
  }

  return null;
}

/**
 * Lot / batch codes often encode a calendar date (e.g. L11122026 → 11.12.2026),
 * but a leading L/Л (or Lot / Партида / …) means batch — never Godnost.
 */
export function looksLikeLotCodeNotExpiry(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  const raw = value.trim();
  if (!raw) return false;
  // L11122026 / л 11.12.2026 / L-268623
  if (/^[LЛlл][\s.\-_]?[\dA-Za-zА-Яа-я]/.test(raw)) return true;
  if (
    /^(LOT|BATCH|SER(?:IE)?|ПАР(?:Т(?:ИДА)?)?|ЛОТ|СЕР(?:ИЯ)?)\b/i.test(raw)
  ) {
    return true;
  }
  return false;
}

/** Lexicographic max on YYYY-MM-DD = furthest calendar day. */
export function pickLatestExpiryYmd(
  ymds: Array<string | null | undefined>,
): string | null {
  let best: string | null = null;
  for (const ymd of ymds) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    if (!best || ymd > best) best = ymd;
  }
  return best;
}

/** True when a date match at `index` looks attached to a lot/batch prefix. */
function hasLotPrefixBefore(raw: string, index: number): boolean {
  const before = raw.slice(Math.max(0, index - 16), index);
  return /(?:^|[^A-Za-zА-Яа-яЁё])(?:L|Л|LOT|ЛОТ|BATCH|ПАР(?:Т(?:ИДА)?)?|СЕР(?:ИЯ)?)\s*$/i.test(
    before,
  );
}

function hasDigitBefore(raw: string, index: number): boolean {
  return index > 0 && /\d/.test(raw.charAt(index - 1));
}

/** Pure numeric date-like blob (no words). Do not fall back to spoken parsing. */
function looksLikeNumericDateBlob(raw: string): boolean {
  return /^\d{1,4}[./\-]\d{1,2}(?:[./\-]\d{1,4})?$/.test(raw.trim());
}

/**
 * NORMAL PATH: find every visible calendar date in a string
 * (DD.MM.YYYY, ISO, month.year, spoken). Lot-prefixed digit runs are skipped
 * so "L11122026" is not read here (that is an exception fallback).
 * Dates after / or \ (e.g. L123/15.06.2027) are normal calendar matches.
 */
export function extractDocumentExpiryYmds(
  value: string | null | undefined,
): string[] {
  if (!value) return [];
  const raw = value.trim();
  if (!raw) return [];

  const found = new Set<string>();

  // Prefer ISO first so we can skip overlapping false DMY hits inside ISO values.
  const isoSpans: Array<{ start: number; end: number }> = [];
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/g;
  for (const match of raw.matchAll(isoRe)) {
    const index = match.index ?? 0;
    if (hasLotPrefixBefore(raw, index)) continue;
    const ymd = formatYmd(Number(match[1]), Number(match[2]), Number(match[3]));
    if (!ymd) continue;
    found.add(ymd);
    isoSpans.push({ start: index, end: index + match[0].length });
  }

  // Same separator twice so "268623/15.06.2027" does not match as 23/15.06.
  const dmyRe = /(\d{1,2})([./\-])(\d{1,2})\2(\d{2,4})/g;
  for (const match of raw.matchAll(dmyRe)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;
    if (hasLotPrefixBefore(raw, index)) continue;
    // Avoid "27-07-30" inside "2027-07-30".
    if (hasDigitBefore(raw, index)) continue;
    if (isoSpans.some((span) => index < span.end && end > span.start)) continue;
    const ymd = formatYmd(Number(match[4]), Number(match[3]), Number(match[1]));
    if (ymd) found.add(ymd);
  }

  if (found.size > 0) return [...found];

  // Whole-string month/year / spoken: not for pure lot codes (L2027 etc.).
  if (looksLikeLotCodeNotExpiry(raw)) return [];

  // Month+year only → last day of that month (12.26 → 2026-12-31).
  const monthYear = parseMonthYearExpiry(raw);
  if (monthYear) return [monthYear];

  // Numeric blobs that failed calendar checks are not spoken dates.
  if (looksLikeNumericDateBlob(raw)) return [];

  // Spoken BG/EN ("трети май 2030 година").
  const spoken = parseSpokenExpiry(raw);
  if (spoken) return [spoken];
  return [];
}

/** Parse common EU/BG date strings into YYYY-MM-DD (latest if several). */
export function parseDocumentExpiry(
  value: string | null | undefined,
): string | null {
  return pickLatestExpiryYmd(extractDocumentExpiryYmds(value));
}

/**
 * NORMAL PATH: printed Godnost cell.
 * Never treat as US month/day. If several dates appear, keep the furthest future.
 * Pure lot codes with no visible calendar date return null (exception path may run later).
 */
export function parsePrintedExpiry(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // Reject ISO-only printed cells — those belong in expiryDate (day/month swap guard).
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;

  return pickLatestExpiryYmd(extractDocumentExpiryYmds(raw));
}

/**
 * Strip a leading lot/batch label (L, Lot, Партида, …). Returns null if no label.
 */
export function stripLotLabelPrefix(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const match =
    /^(?:L|Л|LOT|ЛОТ|BATCH|ПАР(?:Т(?:ИДА)?)?|СЕР(?:ИЯ)?|SER(?:IE)?)[\s.\-_]*(.*)$/iu.exec(
      raw,
    );
  if (!match) return null;
  const rest = match[1]!.trim();
  return rest.length > 0 ? rest : null;
}

/**
 * Compact digits after a lot prefix → calendar day when the digits clearly encode a date.
 * DDMMYYYY (BG common), YYYYMMDD, YYYYMM, or YYYY only.
 */
function parseCompactLotDateDigits(digits: string): string | null {
  if (!/^\d+$/.test(digits)) return null;

  if (digits.length === 8) {
    const dmy = formatYmd(
      Number(digits.slice(4, 8)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(0, 2)),
    );
    const ymd = formatYmd(
      Number(digits.slice(0, 4)),
      Number(digits.slice(4, 6)),
      Number(digits.slice(6, 8)),
    );
    const yearPrefixed = Number(digits.slice(0, 4));
    // Prefer YYYYMMDD when the first four digits are a plausible year.
    if (yearPrefixed >= 2000 && yearPrefixed <= 2100) {
      return ymd ?? dmy;
    }
    return dmy ?? ymd;
  }

  if (digits.length === 6) {
    // YYYYMM → end of month
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    if (year >= 2000 && year <= 2100) {
      return endOfMonthYmd(year, month);
    }
    // MMYYYY
    return endOfMonthYmd(Number(digits.slice(2, 6)), Number(digits.slice(0, 2)));
  }

  if (digits.length === 4) {
    // L2027 → 2027-12-31
    const year = Number(digits);
    if (year >= 2000 && year <= 2100) return endOfMonthYmd(year, 12);
  }

  return null;
}

/** Parse one fragment that may be a date (with dots or compact digits). */
function parseLotDateFragment(fragment: string): string | null {
  const trimmed = fragment.trim();
  if (!trimmed) return null;
  const separated = pickLatestExpiryYmd(extractDocumentExpiryYmds(trimmed));
  if (separated) return separated;
  const monthYear = parseMonthYearExpiry(trimmed);
  if (monthYear) return monthYear;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 4 || digits.length === 6 || digits.length === 8) {
    return parseCompactLotDateDigits(digits);
  }
  return null;
}

/**
 * EXCEPTION ONLY (not normal Godnost parsing).
 * Lot glued to a date with / or \ (date is usually AFTER the slash).
 * Examples: L268623/15.06.2027, 12345\01.12.2026, LOT99/15062027
 * Call only after the normal printed/ISO path returned null.
 */
export function parseExpiryAfterLotSlash(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || !/[/\\]/.test(raw)) return null;

  const parts = raw
    .split(/[/\\]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return null;

  // Prefer segments after the first slash (rightmost first).
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const ymd = parseLotDateFragment(parts[i]!);
    if (ymd) return ymd;
  }
  return null;
}

/**
 * EXCEPTION ONLY (not normal Godnost parsing).
 * When Godnost is empty: derive a date from a lot/batch code
 * (L11122026, L2027, or lot/date with / or \).
 * Never call this to override a real printed expiry.
 */
export function parseExpiryEncodedInLotCode(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  // lot/date or lot\date — works with or without a leading L.
  const fromSlash = parseExpiryAfterLotSlash(value);
  if (fromSlash) return fromSlash;

  if (!looksLikeLotCodeNotExpiry(value)) return null;
  const rest = stripLotLabelPrefix(value);
  if (!rest) return null;

  // Slash may remain after stripping the label (L268623/15.06.2027).
  const fromSlashRest = parseExpiryAfterLotSlash(rest);
  if (fromSlashRest) return fromSlashRest;

  // Separators already look like a normal date (L11.12.2026).
  const separated = parseLotDateFragment(rest);
  if (separated) return separated;

  return null;
}

/**
 * Resolve expiry for one OCR item.
 *
 * NORMAL PATH (always first, never skipped for exceptions):
 * 1. Visible calendar dates in the printed Godnost cell (incl. two dates → later;
 *    incl. a date standing after / or \ next to a lot code).
 * 2. Model ISO expiryDate when printed has no calendar date.
 *
 * EXCEPTIONS (last resort only when normal path found nothing):
 * - Compact lot-encoded digits (L11122026, L2027)
 * - Compact digits after / or \ (LOT99/15062027)
 *
 * Exceptions must never run first and must never replace a real Godnost date.
 */
export function resolveDocumentExpiry(
  expiryDate: string | null | undefined,
  expiryPrinted?: string | null | undefined,
  lot?: string | null | undefined,
): string | null {
  // --- NORMAL PATH (first) ---
  const fromPrinted = parsePrintedExpiry(expiryPrinted);
  if (fromPrinted) return fromPrinted;

  const fromExpiryDate = parseDocumentExpiry(expiryDate);
  if (fromExpiryDate) return fromExpiryDate;

  const fromPrintedLoose = parseDocumentExpiry(expiryPrinted);
  if (fromPrintedLoose) return fromPrintedLoose;

  // --- EXCEPTIONS ONLY (after normal path found nothing) ---
  return (
    parseExpiryEncodedInLotCode(lot) ??
    parseExpiryEncodedInLotCode(expiryPrinted)
  );
}
