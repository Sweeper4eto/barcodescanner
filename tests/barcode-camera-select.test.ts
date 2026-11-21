import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barcodeCameraScore,
  isLikelyBadBarcodeCamera,
  orderBarcodeCameras,
  prepareScannerVideoElement,
  shouldSkipBarcodeFocusConstraints,
} from "../src/lib/barcode-camera";

test("barcodeCameraScore prefers main rear over Samsung ultrawide/macro", () => {
  assert.ok(
    barcodeCameraScore("camera2 0, facing back") >
      barcodeCameraScore("camera2 2, facing back ultra"),
  );
  assert.ok(
    barcodeCameraScore("Back Camera") >
      barcodeCameraScore("camera2 3, facing back macro"),
  );
  assert.ok(barcodeCameraScore("facing back") > barcodeCameraScore("facing front"));
});

test("isLikelyBadBarcodeCamera flags ultra/macro/front", () => {
  assert.equal(isLikelyBadBarcodeCamera("camera2 2, facing back ultra-wide"), true);
  assert.equal(isLikelyBadBarcodeCamera("Front Camera"), true);
  assert.equal(isLikelyBadBarcodeCamera("camera2 0, facing back"), false);
  assert.equal(isLikelyBadBarcodeCamera(""), false);
});

test("orderBarcodeCameras puts main rear first on A53-like lists", () => {
  const ordered = orderBarcodeCameras([
    { id: "uw", label: "camera2 2, facing back ultra wide" },
    { id: "front", label: "camera2 1, facing front" },
    { id: "main", label: "camera2 0, facing back" },
    { id: "macro", label: "camera2 3, facing back macro" },
  ]);
  assert.equal(ordered[0]?.id, "main");
  assert.ok(ordered.findIndex((c) => c.id === "front") > 0);
});

test("shouldSkipBarcodeFocusConstraints is true on iPhone / iPadOS", () => {
  assert.equal(
    shouldSkipBarcodeFocusConstraints({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    }),
    true,
  );
  assert.equal(
    shouldSkipBarcodeFocusConstraints({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    shouldSkipBarcodeFocusConstraints({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    }),
    false,
  );
});

test("prepareScannerVideoElement forces muted inline attributes for iOS", () => {
  const video = {
    muted: false,
    defaultMuted: false,
    playsInline: false,
    autoplay: false,
    attrs: {} as Record<string, string>,
    setAttribute(name: string, value: string) {
      this.attrs[name] = value;
    },
    play() {
      return Promise.resolve();
    },
  };
  prepareScannerVideoElement(video as unknown as HTMLVideoElement);
  assert.equal(video.muted, true);
  assert.equal(video.playsInline, true);
  assert.equal(video.attrs.playsinline, "");
  assert.equal(video.attrs["webkit-playsinline"], "");
  assert.equal(video.attrs.muted, "");
});
