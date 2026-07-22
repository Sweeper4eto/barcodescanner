import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatYmdAsDmy,
  parseFlexibleExpiryInput,
} from "../src/lib/expiry-date-input";
import {
  EXPIRY_PICKER_YEARS_PAST,
  expiryDateBounds,
} from "../src/lib/expiry-date-bounds";

describe("parseFlexibleExpiryInput", () => {
  it("parses DD.MM.YYYY so 06 vs 08 can be typed correctly", () => {
    assert.equal(parseFlexibleExpiryInput("08.06.2027"), "2027-06-08");
    assert.equal(parseFlexibleExpiryInput("06.08.2027"), "2027-08-06");
  });

  it("parses ISO and rejects junk", () => {
    assert.equal(parseFlexibleExpiryInput("2027-06-08"), "2027-06-08");
    assert.equal(parseFlexibleExpiryInput("n/a"), null);
    assert.equal(parseFlexibleExpiryInput("32.01.2027"), null);
  });

  it("formats ymd as dmy for the typed field", () => {
    assert.equal(formatYmdAsDmy("2027-06-08"), "08.06.2027");
  });
});

describe("expiryDateBounds", () => {
  it("blocks past days by default", () => {
    const { min } = expiryDateBounds(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    assert.equal(min, `${y}-${m}-${d}`);
  });

  it("allows several years in the past when editing", () => {
    const { min } = expiryDateBounds(true);
    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setFullYear(expected.getFullYear() - EXPIRY_PICKER_YEARS_PAST);
    const y = expected.getFullYear();
    const m = String(expected.getMonth() + 1).padStart(2, "0");
    const d = String(expected.getDate()).padStart(2, "0");
    assert.equal(min, `${y}-${m}-${d}`);
  });
});
