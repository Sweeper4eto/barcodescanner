import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchesPaymentReference,
  parsePaymentReference,
  paymentReferenceFor,
  resolvePaymentReference,
} from "@/lib/payment-reference";

describe("paymentReferenceFor", () => {
  it("is stable for the same client and month", () => {
    const a = paymentReferenceFor("client_abc", 2026, 10);
    const b = paymentReferenceFor("client_abc", 2026, 10);
    assert.equal(a, b);
    assert.match(a, /^E365-[0-9A-HJKMNP-TV-Z]{4}-202610-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("changes when the month or client changes", () => {
    const base = paymentReferenceFor("client_abc", 2026, 10);
    assert.notEqual(base, paymentReferenceFor("client_abc", 2026, 11));
    assert.notEqual(base, paymentReferenceFor("client_xyz", 2026, 10));
  });

  it("matchesPaymentReference accepts the generated value", () => {
    const ref = paymentReferenceFor("client_abc", 2026, 3);
    assert.equal(matchesPaymentReference(ref, "client_abc", 2026, 3), true);
    assert.equal(
      matchesPaymentReference(ref.toLowerCase(), "client_abc", 2026, 3),
      true,
    );
    assert.equal(matchesPaymentReference(ref, "other", 2026, 3), false);
  });

  it("parse and resolve find the owning client", () => {
    const ref = paymentReferenceFor("client_abc", 2026, 10);
    const parsed = parsePaymentReference(`  ${ref.toLowerCase()}  `);
    assert.ok(parsed);
    assert.equal(parsed.year, 2026);
    assert.equal(parsed.month, 10);
    const hit = resolvePaymentReference(ref, [
      "other",
      "client_abc",
      "someone",
    ]);
    assert.deepEqual(hit, {
      clientId: "client_abc",
      year: 2026,
      month: 10,
    });
    assert.equal(resolvePaymentReference(ref, ["other"]), null);
  });
});
