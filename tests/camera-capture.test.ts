import test from "node:test";
import assert from "node:assert/strict";
import {
  prefersNativeCameraCapture,
  resolveUseNativeCapture,
} from "../src/components/camera-capture";
import {
  facingCameraConstraints,
  planMaximizeTrackQuality,
  shouldRepickCameraAfterOpen,
} from "../src/lib/document-camera";

test("prefersNativeCameraCapture is always off (avoid iOS re-prompts)", () => {
  assert.equal(prefersNativeCameraCapture(), false);
});

test("resolveUseNativeCapture never opens native picker", () => {
  assert.equal(resolveUseNativeCapture(false, false, true), false);
  assert.equal(resolveUseNativeCapture(false, true, true), false);
  assert.equal(resolveUseNativeCapture(true, false, true), false);
  assert.equal(resolveUseNativeCapture(false, false, false), false);
});

test("document scan iOS path keeps soft open + no post-Allow lens switch", () => {
  // Regression: iPhone 17 document scan showed black after Allow when we
  // maximized resolution/focus and stopped/restarted the stream.
  assert.equal(shouldRepickCameraAfterOpen(true), false);
  assert.equal(
    planMaximizeTrackQuality({ ios: true, phase: "preview" }).mode,
    "skip",
  );
  assert.equal(
    JSON.stringify(facingCameraConstraints(true)).includes("4032"),
    false,
  );
});
