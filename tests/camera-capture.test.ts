import test from "node:test";
import assert from "node:assert/strict";
import { resolveUseNativeCapture } from "../src/components/camera-capture";

test("resolveUseNativeCapture skips native picker for document layout", () => {
  assert.equal(resolveUseNativeCapture(false, true, true), false);
});

test("resolveUseNativeCapture skips native picker when forced in-app", () => {
  assert.equal(resolveUseNativeCapture(true, false, true), false);
});

test("resolveUseNativeCapture allows native picker for product photos on iOS", () => {
  assert.equal(resolveUseNativeCapture(false, false, true), true);
  assert.equal(resolveUseNativeCapture(false, false, false), false);
});

test("document layout never uses native capture even when iOS prefers it", () => {
  assert.equal(resolveUseNativeCapture(false, true, true), false);
  assert.equal(resolveUseNativeCapture(true, true, true), false);
});
