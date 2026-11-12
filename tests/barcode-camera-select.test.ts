import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barcodeCameraScore,
  isLikelyBadBarcodeCamera,
  orderBarcodeCameras,
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
