import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS,
  GEMINI_FREE_TIER_COOLDOWN_MS,
  GEMINI_HANG_TIMEOUT_COOLDOWN_MS,
  GEMINI_PAID_FALLBACK_MODEL,
  GEMINI_PAID_FALLBACK_TRIGGER_MODEL,
  clearGeminiFreeTierCooldownsForTests,
  documentAiFetchTimeoutMs,
  getGeminiPaidApiKey,
  isGeminiFreeTierQuotaError,
  isGeminiModelCoolingDown,
  isProviderHangTimeoutError,
  isProviderHighDemandError,
  markGeminiModelFreeTierExhausted,
  markGeminiModelHangTimeout,
  parseDocumentExpiry,
  parseGeminiRetryAfterMs,
  parsePrintedExpiry,
  repairTruncatedItemsJson,
  resolveDocumentExpiry,
  shouldTryGeminiPaidFallback,
} from "../src/lib/document-ai";

describe("isGeminiFreeTierQuotaError", () => {
  it("detects free-tier quota 429s that need hours, not seconds", () => {
    assert.equal(
      isGeminiFreeTierQuotaError(
        "OCR_PROVIDER:429:Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.5-flash Please retry in 2h24m9s.",
      ),
      true,
    );
    assert.equal(
      isGeminiFreeTierQuotaError("OCR_PROVIDER:503:high demand"),
      false,
    );
    assert.equal(
      isGeminiFreeTierQuotaError(
        "OCR_PROVIDER:504:Request timed out after 40000ms",
      ),
      false,
    );
    // Generic retry hint alone is not free-tier depletion.
    assert.equal(
      isGeminiFreeTierQuotaError("OCR_PROVIDER:429:Please retry in 2h"),
      false,
    );
  });
});

describe("parseGeminiRetryAfterMs / free-tier cooldown", () => {
  it("parses retry-after durations from quota errors", () => {
    assert.equal(
      parseGeminiRetryAfterMs("Please retry in 2h24m9s."),
      ((2 * 60 + 24) * 60 + 9) * 1000,
    );
    assert.equal(parseGeminiRetryAfterMs("retry in 45m"), 45 * 60 * 1000);
    assert.equal(parseGeminiRetryAfterMs("no hint"), null);
  });

  it("skips models for 10 minutes after free-tier then retries", () => {
    clearGeminiFreeTierCooldownsForTests();
    const now = 1_000_000;
    markGeminiModelFreeTierExhausted(
      "gemini-3.5-flash",
      "Please retry in 2h24m9s.",
      now,
    );
    assert.equal(GEMINI_FREE_TIER_COOLDOWN_MS, 10 * 60 * 1000);
    assert.equal(
      isGeminiModelCoolingDown("gemini-3.5-flash", now + 1000),
      "free_tier",
    );
    assert.equal(
      isGeminiModelCoolingDown(
        "gemini-3.5-flash",
        now + GEMINI_FREE_TIER_COOLDOWN_MS,
      ),
      null,
    );
    clearGeminiFreeTierCooldownsForTests();
  });

  it("skips models for 5 minutes after hang timeout then retries", () => {
    clearGeminiFreeTierCooldownsForTests();
    const now = 1_000_000;
    markGeminiModelHangTimeout("gemini-3-flash-preview", now);
    assert.equal(GEMINI_HANG_TIMEOUT_COOLDOWN_MS, 5 * 60 * 1000);
    assert.equal(
      isGeminiModelCoolingDown("gemini-3-flash-preview", now + 1000),
      "hang",
    );
    assert.equal(
      isGeminiModelCoolingDown(
        "gemini-3-flash-preview",
        now + GEMINI_HANG_TIMEOUT_COOLDOWN_MS,
      ),
      null,
    );
    clearGeminiFreeTierCooldownsForTests();
  });

  it("never cools down either flash-lite model", () => {
    clearGeminiFreeTierCooldownsForTests();
    const now = 1_000_000;
    for (const model of ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]) {
      markGeminiModelFreeTierExhausted(model, "Please retry in 8h.", now);
      markGeminiModelHangTimeout(model, now);
      assert.equal(isGeminiModelCoolingDown(model, now + 1000), null);
    }
    clearGeminiFreeTierCooldownsForTests();
  });
});

describe("isProviderHighDemandError", () => {
  it("detects 503 high demand so we skip same-model retry", () => {
    assert.equal(
      isProviderHighDemandError(
        "OCR_PROVIDER:503:This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
      ),
      true,
    );
    assert.equal(isProviderHighDemandError("OCR_PROVIDER:503:overloaded"), true);
    assert.equal(
      isProviderHighDemandError("OCR_PROVIDER:504:Request timed out after 40000ms"),
      false,
    );
  });
});

describe("shouldTryGeminiPaidFallback", () => {
  it("fires on high demand for gemini-3-flash-preview", () => {
    assert.equal(GEMINI_PAID_FALLBACK_TRIGGER_MODEL, "gemini-3-flash-preview");
    assert.equal(GEMINI_PAID_FALLBACK_MODEL, "gemini-3.8-flash");
    assert.equal(
      shouldTryGeminiPaidFallback({
        triggerModel: GEMINI_PAID_FALLBACK_TRIGGER_MODEL,
        errorMessage:
          "OCR_PROVIDER:503:This model is currently experiencing high demand.",
      }),
      true,
    );
  });

  it("does not fire on high demand for other free-cascade models", () => {
    assert.equal(
      shouldTryGeminiPaidFallback({
        triggerModel: "gemini-3.5-flash-lite",
        errorMessage: "OCR_PROVIDER:503:high demand",
      }),
      false,
    );
  });

  it("fires when free cascade is exhausted", () => {
    assert.equal(
      shouldTryGeminiPaidFallback({ cascadeExhausted: true }),
      true,
    );
  });

  it("reads GEMINI_API_KEY_PAID from env", () => {
    const prev = process.env.GEMINI_API_KEY_PAID;
    try {
      delete process.env.GEMINI_API_KEY_PAID;
      assert.equal(getGeminiPaidApiKey(), null);
      process.env.GEMINI_API_KEY_PAID = "  paid-test-key  ";
      assert.equal(getGeminiPaidApiKey(), "paid-test-key");
    } finally {
      if (prev === undefined) delete process.env.GEMINI_API_KEY_PAID;
      else process.env.GEMINI_API_KEY_PAID = prev;
    }
  });
});

describe("isProviderHangTimeoutError", () => {
  it("detects our AbortSignal timeout and Undici headers timeout", () => {
    assert.equal(
      isProviderHangTimeoutError(
        "OCR_PROVIDER:504:Request timed out after 40000ms",
      ),
      true,
    );
    assert.equal(
      isProviderHangTimeoutError(
        "fetch failed: Headers Timeout Error UND_ERR_HEADERS_TIMEOUT",
      ),
      true,
    );
    assert.equal(
      isProviderHangTimeoutError("OCR_PROVIDER:503:high demand"),
      false,
    );
  });
});

describe("documentAiFetchTimeoutMs", () => {
  it("defaults to 40s and clamps env overrides", () => {
    const prev = process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
    try {
      delete process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
      assert.equal(documentAiFetchTimeoutMs(), DEFAULT_DOCUMENT_AI_FETCH_TIMEOUT_MS);
      process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = "1000";
      assert.equal(documentAiFetchTimeoutMs(), 5_000);
      process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = "999999";
      assert.equal(documentAiFetchTimeoutMs(), 180_000);
    } finally {
      if (prev === undefined) delete process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS;
      else process.env.DOCUMENT_AI_FETCH_TIMEOUT_MS = prev;
    }
  });
});

describe("parseDocumentExpiry", () => {
  it("parses ISO dates", () => {
    assert.equal(parseDocumentExpiry("2026-07-18"), "2026-07-18");
  });

  it("parses DMY with dots", () => {
    assert.equal(parseDocumentExpiry("18.07.2026"), "2026-07-18");
  });

  it("parses DMY with slashes and short year", () => {
    assert.equal(parseDocumentExpiry("5/1/26"), "2026-01-05");
  });

  it("uses compact DDMMYY/DDMMYYYY only as last resort when normal Godnost is missing", () => {
    // Normal path does not treat bare digit blobs as dates.
    assert.equal(parseDocumentExpiry("170827"), null);
    assert.equal(parsePrintedExpiry("170827"), null);
    assert.equal(parseDocumentExpiry("17082027"), null);
    assert.equal(parsePrintedExpiry("15062027"), null);
    // Exception path via resolveDocumentExpiry.
    assert.equal(resolveDocumentExpiry(null, "170827"), "2027-08-17");
    assert.equal(resolveDocumentExpiry(null, "190827"), "2027-08-19");
    assert.equal(resolveDocumentExpiry(null, "160827"), "2027-08-16");
    assert.equal(resolveDocumentExpiry(null, "300927"), "2027-09-30");
    assert.equal(resolveDocumentExpiry(null, "17082027"), "2027-08-17");
    assert.equal(resolveDocumentExpiry(null, "30092027"), "2027-09-30");
    assert.equal(resolveDocumentExpiry(null, "15062027"), "2027-06-15");
    assert.equal(resolveDocumentExpiry(null, "11122026"), "2026-12-11");
    // Real dotted Godnost still wins over compact digits elsewhere.
    assert.equal(
      resolveDocumentExpiry(null, "23.06.2027", "170827"),
      "2027-06-23",
    );
    assert.equal(resolveDocumentExpiry(null, "268623"), null);
    assert.equal(parsePrintedExpiry("268623"), null);
  });

  it("prefers Използвай до/преди compact date over lot digits", async () => {
    const { parseCompactExpiryFallback, looksLikeLotCodeNotExpiry } =
      await import("../src/lib/expiry-parse");
    assert.equal(
      parseCompactExpiryFallback("Използвай до: 271226"),
      "2026-12-27",
    );
    assert.equal(
      parseCompactExpiryFallback("Използвай преди: 271226"),
      "2026-12-27",
    );
    assert.equal(looksLikeLotCodeNotExpiry("L: 020826"), true);
    // Real use-by wins; lot must not become 02.08.2026.
    assert.equal(
      resolveDocumentExpiry(null, "Използвай до: 271226", "L: 020826"),
      "2026-12-27",
    );
    assert.equal(
      resolveDocumentExpiry(null, "Използвай преди:271226", "L: 020826"),
      "2026-12-27",
    );
    // Lot→date only when Godnost / use-by compact is missing.
    assert.equal(
      resolveDocumentExpiry(null, null, "L: 020826"),
      "2026-08-02",
    );
  });

  it("returns null for empty or invalid", () => {
    assert.equal(parseDocumentExpiry(""), null);
    assert.equal(parseDocumentExpiry("n/a"), null);
  });

  it("accepts date with trailing lot/batch text", () => {
    assert.equal(parseDocumentExpiry("23.06.2027 L268623"), "2027-06-23");
    assert.equal(parseDocumentExpiry("2027-06-23 L268623"), "2027-06-23");
    assert.equal(parseDocumentExpiry("23.06.2027 L11122026"), "2027-06-23");
  });

  it("does not treat bare L-codes as normal printed expiry text", () => {
    assert.equal(parseDocumentExpiry("L11122026"), null);
    assert.equal(parseDocumentExpiry("L11.12.2026"), null);
    assert.equal(parsePrintedExpiry("L11122026"), null);
    assert.equal(parsePrintedExpiry("л11122026"), null);
  });

  it("derives expiry from lot code only when Godnost is missing", async () => {
    const {
      parseExpiryEncodedInLotCode,
      parseExpiryAfterLotSlash,
      looksLikeLotCodeNotExpiry,
    } = await import("../src/lib/expiry-parse");
    // Exceptions: compact lot encoding (not first-line Godnost parsing).
    assert.equal(parseExpiryEncodedInLotCode("L11122026"), "2026-12-11");
    assert.equal(parseExpiryEncodedInLotCode("L 11122026"), "2026-12-11");
    assert.equal(parseExpiryEncodedInLotCode("L  2027"), "2027-12-31");
    assert.equal(parseExpiryEncodedInLotCode("L11.12.2026"), "2026-12-11");
    assert.equal(parseExpiryEncodedInLotCode("L2027"), "2027-12-31");
    assert.equal(parseExpiryEncodedInLotCode("L202712"), "2027-12-31");
    assert.equal(parseExpiryEncodedInLotCode("L268623"), null);
    assert.equal(parseExpiryEncodedInLotCode("L 268623"), null);
    assert.equal(looksLikeLotCodeNotExpiry("L 23232323"), true);
    assert.equal(parseDocumentExpiry("L 23232323"), null);
    // Space-after-L date digits: last resort only when Godnost missing.
    assert.equal(
      resolveDocumentExpiry(null, null, "L 11122026"),
      "2026-12-11",
    );
    assert.equal(
      resolveDocumentExpiry(null, "23.06.2027", "L 11122026"),
      "2027-06-23",
    );
    assert.equal(parseExpiryEncodedInLotCode("LOT99/15062027"), "2027-06-15");
    assert.equal(
      parseExpiryAfterLotSlash("L268623/15.06.2027"),
      "2027-06-15",
    );
    // Visible calendar date after / is normal path, not exception-first.
    assert.equal(
      parsePrintedExpiry("L268623/15.06.2027"),
      "2027-06-15",
    );
    assert.equal(
      parsePrintedExpiry("268623\\01.12.2026"),
      "2026-12-01",
    );
    // Real printed Godnost wins over lot exception.
    assert.equal(
      resolveDocumentExpiry(null, "23.06.2027", "L11122026"),
      "2027-06-23",
    );
    assert.equal(resolveDocumentExpiry(null, "L11122026"), "2026-12-11");
    assert.equal(resolveDocumentExpiry(null, null, "L2027"), "2027-12-31");
    assert.equal(
      resolveDocumentExpiry("2026-12-11", "L11122026"),
      "2026-12-11",
    );
    assert.equal(
      resolveDocumentExpiry(null, null, "ABC123/12.2027"),
      "2027-12-31",
    );
  });

  it("rejects impossible calendar dates", () => {
    assert.equal(parseDocumentExpiry("31.02.2026"), null);
    assert.equal(parseDocumentExpiry("2026-02-31"), null);
  });

  it("treats month+year as end of that month", () => {
    assert.equal(parseDocumentExpiry("12.2026"), "2026-12-31");
    assert.equal(parseDocumentExpiry("12.26"), "2026-12-31");
    assert.equal(parseDocumentExpiry("12/26"), "2026-12-31");
    assert.equal(parseDocumentExpiry("12-2026"), "2026-12-31");
    assert.equal(parseDocumentExpiry("2026-12"), "2026-12-31");
    assert.equal(parseDocumentExpiry("02.26"), "2026-02-28");
    assert.equal(parseDocumentExpiry("02.2028"), "2028-02-29");
  });

  it("parses spoken Bulgarian and English dates", () => {
    assert.equal(parseDocumentExpiry("трети май 2030 година"), "2030-05-03");
    assert.equal(parseDocumentExpiry("3 май 2030"), "2030-05-03");
    assert.equal(parseDocumentExpiry("май 2030"), "2030-05-31");
    assert.equal(parseDocumentExpiry("двадесет и първи декември 2026"), "2026-12-21");
    assert.equal(parseDocumentExpiry("third of May 2030"), "2030-05-03");
    assert.equal(parseDocumentExpiry("May 3 2030"), "2030-05-03");
  });

  it("parses Bulgarian year shorthand (двадесет и пета / 25-та → 2025)", () => {
    assert.equal(parseDocumentExpiry("трети май двадесет и пета"), "2025-05-03");
    assert.equal(parseDocumentExpiry("3 май 25-та"), "2025-05-03");
    assert.equal(parseDocumentExpiry("май двадесет и пета"), "2025-05-31");
    assert.equal(parseDocumentExpiry("двадесет и пета"), "2025-12-31");
    assert.equal(parseDocumentExpiry("25-та"), "2025-12-31");
    assert.equal(parseDocumentExpiry("15 юни 28 ма"), "2028-06-15");
    assert.equal(parseDocumentExpiry("14-ти месец май 2029 година"), "2029-05-14");
    assert.equal(parseDocumentExpiry("май месец 2030"), "2030-05-31");
  });

  it("finds 3ти май 2031 inside a longer spoken phrase", async () => {
    const { findSpokenDateInText } = await import("../src/lib/expiry-parse");
    assert.equal(
      findSpokenDateInText(
        "тунквана вафла швепс 10 броя 3ти май 2031 година",
      ),
      "2031-05-03",
    );
  });
});

describe("resolveDocumentExpiry", () => {
  it("prefers printed DD.MM.YYYY over swapped ISO month/day", () => {
    // Model often emits US order ISO for Bulgarian 01.12.2027
    assert.equal(
      resolveDocumentExpiry("2027-01-12", "01.12.2027"),
      "2027-12-01",
    );
  });

  it("keeps January 12 when printed says 12.01", () => {
    assert.equal(
      resolveDocumentExpiry("2026-12-01", "12.01.2026"),
      "2026-01-12",
    );
  });

  it("falls back to ISO when printed is missing", () => {
    assert.equal(resolveDocumentExpiry("2027-12-01", null), "2027-12-01");
  });

  it("prefers expiryDate ISO over ISO wrongly put in printed", () => {
    assert.equal(
      resolveDocumentExpiry("2027-12-01", "2027-01-12"),
      "2027-12-01",
    );
  });

  it("uses ISO from printed when expiryDate is missing", () => {
    assert.equal(resolveDocumentExpiry(null, "2027-02-11"), "2027-02-11");
    assert.equal(resolveDocumentExpiry("", "2027-07-30"), "2027-07-30");
  });

  it("when two dates are printed, keeps the later one (expiry over manufacture)", () => {
    assert.equal(
      parseDocumentExpiry("01.03.2025 15.06.2027"),
      "2027-06-15",
    );
    assert.equal(
      parseDocumentExpiry("произв. 01.03.2025 годен до 15.06.2027"),
      "2027-06-15",
    );
    assert.equal(
      resolveDocumentExpiry(null, "05.01.2026 05.01.2028"),
      "2028-01-05",
    );
    assert.equal(
      resolveDocumentExpiry(null, "15.06.2027 01.03.2025"),
      "2027-06-15",
    );
  });

  it("still ignores lot-looking dates after a real expiry", () => {
    assert.equal(
      parseDocumentExpiry("23.06.2027 L11.12.2026"),
      "2027-06-23",
    );
  });
});

describe("parsePrintedExpiry", () => {
  it("always reads day first", () => {
    assert.equal(parsePrintedExpiry("01.12.2027"), "2027-12-01");
    assert.equal(parsePrintedExpiry("12.01.2027"), "2027-01-12");
  });

  it("treats month+year Godnost as end of month", () => {
    assert.equal(parsePrintedExpiry("12.26"), "2026-12-31");
    assert.equal(parsePrintedExpiry("12.2026"), "2026-12-31");
    assert.equal(parsePrintedExpiry("11/26"), "2026-11-30");
  });
});

describe("repairTruncatedItemsJson", () => {
  it("reconstructs when the closing root brace is missing", () => {
    const raw = '{\n"items":[{"name":"A"},{"name":"B"}]';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("drops an incomplete trailing object", () => {
    const raw = '{"items":[{"name":"A"},{"name":"B"},{"name":"C';
    const repaired = repairTruncatedItemsJson(raw);
    assert.ok(repaired);
    const parsed = JSON.parse(repaired!);
    assert.deepEqual(parsed.items, [{ name: "A" }, { name: "B" }]);
  });

  it("returns null when there is no complete object", () => {
    assert.equal(repairTruncatedItemsJson('{"items":[{"name":"A'), null);
  });
});
