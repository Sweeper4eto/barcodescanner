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

/** Parse common EU/BG date strings into YYYY-MM-DD. */
export function parseDocumentExpiry(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    return formatYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  // Bulgarian / EU documents use day.month.year (not US month/day).
  // Allow trailing lot/batch text, e.g. "23.06.2027 L268623".
  const dmy = /^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (dmy) {
    return formatYmd(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  // ISO date with optional trailing lot text.
  const isoLoose = /^(\d{4})-(\d{2})-(\d{2})(?:\s+.*)?$/.exec(raw);
  if (isoLoose) {
    return formatYmd(
      Number(isoLoose[1]),
      Number(isoLoose[2]),
      Number(isoLoose[3]),
    );
  }

  // Month+year only → last day of that month (12.26 → 2026-12-31).
  const monthYear = parseMonthYearExpiry(raw);
  if (monthYear) return monthYear;

  // Spoken BG/EN ("трети май 2030 година").
  return parseSpokenExpiry(raw);
}

/**
 * Parse printed Godnost: day.month.year, or month.year → end of month.
 * Never treat as US month/day.
 */
export function parsePrintedExpiry(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  // Reject full ISO day values in the printed field — those belong in expiryDate.
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;

  const dmy = /^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})(?:\s+.*)?$/.exec(raw);
  if (dmy) {
    return formatYmd(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }

  const monthYear = parseMonthYearExpiry(raw);
  if (monthYear) return monthYear;

  return parseSpokenExpiry(raw);
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
  const fromExpiryDate = parseDocumentExpiry(expiryDate);
  if (fromExpiryDate) return fromExpiryDate;
  return parseDocumentExpiry(expiryPrinted);
}
