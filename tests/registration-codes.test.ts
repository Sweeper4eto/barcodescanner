import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  normalizeRegistrationCode,
  REGISTRATION_CODE_LENGTH,
  validateRegistrationCodeFormat,
} from "../src/lib/registration-codes";

describe("registration codes", () => {
  test("accepts exact-length digits only", () => {
    assert.equal(validateRegistrationCodeFormat("12345678"), null);
    assert.equal(validateRegistrationCodeFormat(" 12345678 "), null);
    assert.equal(normalizeRegistrationCode(" 12 345 678 "), "12345678");
  });

  test("rejects missing, letters, and wrong length", () => {
    assert.equal(
      validateRegistrationCodeFormat(""),
      "auth.registrationCodeRequired",
    );
    assert.equal(
      validateRegistrationCodeFormat("12ab5678"),
      "auth.registrationCodeDigitsOnly",
    );
    assert.equal(
      validateRegistrationCodeFormat("123"),
      "auth.registrationCodeInvalid",
    );
    assert.equal(REGISTRATION_CODE_LENGTH, 8);
  });
});
