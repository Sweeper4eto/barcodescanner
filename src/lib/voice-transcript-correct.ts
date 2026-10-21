/**
 * Soft-correct ONLY severe Bulgarian grocery STT garble
 * (e.g. "филипове" → "филета", "маил" → "рибни").
 *
 * Do NOT normalize real words into more-common products
 * ("кисела диня" must never become "кисело мляко").
 */

/** Exact words we leave untouched (including less-common foods). */
const PROTECTED_WORDS = new Set([
  "кисела",
  "кисели",
  "кисело",
  "диня",
  "дини",
  "рибни",
  "рибно",
  "риба",
  "филета",
  "филе",
  "мляко",
  "прясно",
  "тунквана",
  "вафла",
  "вафли",
  "фъстъци",
  "фъстък",
  "хляб",
  "сирене",
  "кашкавал",
  "колбас",
  "шунка",
  "масло",
  "яйца",
  "яйце",
  "олио",
  "брашно",
  "захар",
  "сол",
  "ориз",
  "макарони",
  "спагети",
  "кренвирши",
  "наденица",
  "кайма",
  "пиле",
  "пилешко",
  "свинско",
  "телешко",
  "швепс",
  "ройс",
  "вода",
  "сок",
  "бира",
  "вино",
  "кафе",
  "чай",
  "йогурт",
  "извара",
  "сметана",
  "майонеза",
  "кетчуп",
  "лютеница",
  "домати",
  "краставици",
  "чушки",
  "картофи",
  "лук",
  "чесън",
  "ябълки",
  "банани",
  "портокали",
  "шоколад",
  "бисквити",
  "чипс",
  "пастет",
  "консерва",
  "скумрия",
  "сьомга",
  "тон",
]);

/**
 * Hand-tuned severe STT garble only — never gender/ending normalization
 * and never “common product” substitution.
 */
const KNOWN_MISHEARINGS: Record<string, string> = {
  филипове: "филета",
  филипи: "филета",
  филето: "филета",
  филети: "филета",
  рибний: "рибни",
  маил: "рибни",
  майл: "рибни",
  // Quantity unit garble → canonical броя
  брояа: "броя",
  бройа: "броя",
  броял: "броя",
  броят: "броя",
  бройове: "броя",
};

/**
 * Replace only known severe mishearings. Real words (кисела, диня, …) stay as spoken.
 */
export function correctGroceryTranscript(transcript: string): string {
  const parts = transcript.trim().split(/(\s+)/);
  return parts
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      const core = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (!core) return part;
      const lower = core.toLowerCase();
      if (PROTECTED_WORDS.has(lower)) return part;
      const fixed = KNOWN_MISHEARINGS[lower];
      if (!fixed) return part;
      return part.replace(core, fixed);
    })
    .join("");
}
