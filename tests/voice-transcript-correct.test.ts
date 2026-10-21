import test from "node:test";
import assert from "node:assert/strict";
import { correctGroceryTranscript } from "../src/lib/voice-transcript-correct";

test("correctGroceryTranscript fixes severe STT garble only", () => {
  assert.equal(correctGroceryTranscript("филипове"), "филета");
  assert.equal(
    correctGroceryTranscript("маил филипове"),
    "рибни филета",
  );
});

test("correctGroceryTranscript never turns кисела диня into кисело мляко", () => {
  assert.equal(
    correctGroceryTranscript("кисела диня"),
    "кисела диня",
  );
  assert.equal(
    correctGroceryTranscript("кисело мляко"),
    "кисело мляко",
  );
});

test("correctGroceryTranscript keeps a good phrase", () => {
  assert.equal(
    correctGroceryTranscript("рибни филета"),
    "рибни филета",
  );
});
