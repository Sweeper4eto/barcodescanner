import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  resetVoiceRateLimitsForTests,
  takeVoiceParseSlot,
} from "../src/lib/voice-rate-limit";
import {
  resetDocumentOcrRateLimitsForTests,
  takeDocumentOcrSlot,
} from "../src/lib/document-ocr-rate-limit";

describe("voice-rate-limit", () => {
  beforeEach(() => {
    resetVoiceRateLimitsForTests();
    resetDocumentOcrRateLimitsForTests();
  });

  it("does not consume document OCR slots", () => {
    const userId = "shared-user";
    for (let i = 0; i < 60; i += 1) {
      assert.equal(takeVoiceParseSlot(userId), null);
    }
    assert.notEqual(takeVoiceParseSlot(userId), null);
    // Document OCR still has a full window available.
    assert.equal(takeDocumentOcrSlot(userId), null);
  });

  it("document OCR does not consume voice slots", () => {
    const userId = "shared-user";
    for (let i = 0; i < 50; i += 1) {
      assert.equal(takeDocumentOcrSlot(userId), null);
    }
    assert.notEqual(takeDocumentOcrSlot(userId), null);
    assert.equal(takeVoiceParseSlot(userId), null);
  });
});
