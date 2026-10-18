import test from "node:test";
import assert from "node:assert/strict";
import { isIosSaveTarget, pictureSaveStatus } from "../src/lib/picture-save";

test("iPhone, iPad, and iPad-as-Mac save by preview", () => {
  assert.equal(
    isIosSaveTarget({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    isIosSaveTarget({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)",
      platform: "iPad",
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    isIosSaveTarget({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    true,
  );
});

test("desktop browsers save with a download", () => {
  assert.equal(
    isIosSaveTarget({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      platform: "Win32",
      maxTouchPoints: 0,
    }),
    false,
  );
  assert.equal(pictureSaveStatus(false, true), "saved");
  assert.equal(pictureSaveStatus(false, false), "failed");
});

test("iOS always previews, even when a download link would start", () => {
  assert.equal(pictureSaveStatus(true, true), "preview");
  assert.equal(pictureSaveStatus(true, false), "preview");
});
