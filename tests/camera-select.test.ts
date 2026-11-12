import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cameraLabelScore,
  isLikelyBadCaptureCamera,
  orderCamerasByLabel,
  pickPreferredCameraId,
} from "../src/lib/camera-select";

test("cameraLabelScore prefers main rear over Samsung ultrawide/macro", () => {
  assert.ok(
    cameraLabelScore("camera2 0, facing back") >
      cameraLabelScore("camera2 2, facing back ultra"),
  );
  assert.ok(
    cameraLabelScore("Back Camera") >
      cameraLabelScore("camera2 3, facing back macro"),
  );
  assert.ok(cameraLabelScore("facing back") > cameraLabelScore("facing front"));
});

test("isLikelyBadCaptureCamera flags ultra/macro/front", () => {
  assert.equal(
    isLikelyBadCaptureCamera("camera2 2, facing back ultra-wide"),
    true,
  );
  assert.equal(isLikelyBadCaptureCamera("Front Camera"), true);
  assert.equal(isLikelyBadCaptureCamera("camera2 0, facing back"), false);
  assert.equal(isLikelyBadCaptureCamera(""), false);
});

test("pickPreferredCameraId picks main rear on A53-like lists", () => {
  const preferred = pickPreferredCameraId([
    { deviceId: "uw", label: "camera2 2, facing back ultra wide" },
    { deviceId: "front", label: "camera2 1, facing front" },
    { deviceId: "main", label: "camera2 0, facing back" },
    { deviceId: "macro", label: "camera2 3, facing back macro" },
  ]);
  assert.equal(preferred, "main");
});

test("orderCamerasByLabel puts main rear first", () => {
  const ordered = orderCamerasByLabel([
    { deviceId: "uw", label: "camera2 2, facing back ultra wide" },
    { deviceId: "main", label: "camera2 0, facing back" },
  ]);
  assert.equal(ordered[0]?.deviceId, "main");
});
