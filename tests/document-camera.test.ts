import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deviceIdCameraConstraints,
  facingCameraConstraints,
  isIosLikeUserAgent,
  planMaximizeTrackQuality,
  shouldApplySingleShotFocus,
  shouldRepickCameraAfterOpen,
} from "../src/lib/document-camera";

test("isIosLikeUserAgent detects iPhone and iPadOS-as-Mac", () => {
  assert.equal(
    isIosLikeUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    ),
    true,
  );
  assert.equal(
    isIosLikeUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "MacIntel",
      5,
    ),
    true,
  );
  assert.equal(
    isIosLikeUserAgent(
      "Mozilla/5.0 (Linux; Android 14; SM-A536B)",
      "Linux armv8l",
      5,
    ),
    false,
  );
});

test("facingCameraConstraints on iOS avoids exact facingMode and 4K ideals", () => {
  const ios = facingCameraConstraints(true);
  const serialized = JSON.stringify(ios);
  assert.equal(serialized.includes('"exact"'), false);
  assert.equal(serialized.includes("4032"), false);
  assert.equal(ios[0]?.video && typeof ios[0].video === "object", true);
  assert.deepEqual(ios[0], {
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
});

test("facingCameraConstraints on Android keeps high-res rear first", () => {
  const android = facingCameraConstraints(false);
  assert.deepEqual(android[0], {
    video: {
      facingMode: { exact: "environment" },
      width: { ideal: 4032 },
      height: { ideal: 3024 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
});

test("deviceIdCameraConstraints stays soft on iOS", () => {
  const ios = deviceIdCameraConstraints("cam-1", true);
  assert.deepEqual(ios[0], {
    video: { deviceId: { ideal: "cam-1" } },
    audio: false,
  });
  assert.equal(JSON.stringify(ios).includes('"exact"'), false);
});

test("shouldRepickCameraAfterOpen is off on iOS to avoid black preview", () => {
  assert.equal(shouldRepickCameraAfterOpen(true), false);
  assert.equal(shouldRepickCameraAfterOpen(false), true);
});

test("shouldApplySingleShotFocus is off on iOS", () => {
  assert.equal(shouldApplySingleShotFocus(true), false);
  assert.equal(shouldApplySingleShotFocus(false), true);
});

test("planMaximizeTrackQuality skips iOS preview thrashing", () => {
  assert.deepEqual(
    planMaximizeTrackQuality({
      ios: true,
      phase: "preview",
      widthMax: 4032,
      heightMax: 3024,
      focusModes: ["continuous", "single-shot"],
      exposureModes: ["continuous"],
    }),
    { mode: "skip" },
  );
});

test("planMaximizeTrackQuality uses gentle iOS capture constraints", () => {
  assert.deepEqual(
    planMaximizeTrackQuality({
      ios: true,
      phase: "capture",
      widthMax: 4032,
      heightMax: 3024,
      focusModes: ["continuous"],
    }),
    {
      mode: "apply",
      widthIdeal: 1920,
      heightIdeal: 1080,
      advanced: [],
    },
  );
});

test("planMaximizeTrackQuality keeps aggressive Android preview plan", () => {
  const plan = planMaximizeTrackQuality({
    ios: false,
    phase: "preview",
    widthMax: 4032,
    heightMax: 3024,
    focusModes: ["continuous"],
    exposureModes: ["continuous"],
    whiteBalanceModes: ["continuous"],
  });
  assert.equal(plan.mode, "apply");
  if (plan.mode !== "apply") return;
  assert.equal(plan.widthIdeal, 4032);
  assert.equal(plan.heightIdeal, 3024);
  assert.deepEqual(plan.advanced, [
    { focusMode: "continuous" },
    { exposureMode: "continuous" },
    { whiteBalanceMode: "continuous" },
  ]);
});
