import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { UploadError, saveDataUrl, saveUpload } from "../src/lib/upload";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

test("saveUpload rejects invalid file extension", async () => {
  const file = new File([Buffer.from("data")], "test.exe", {
    type: "application/octet-stream",
  });

  await assert.rejects(() => saveUpload(file), (error: unknown) => {
    assert.ok(error instanceof UploadError);
    assert.equal(error.errorKey, "errors.invalidFileFormat");
    return true;
  });
});

test("saveUpload rejects files larger than 5MB", async () => {
  const large = Buffer.alloc(5 * 1024 * 1024 + 1);
  const file = new File([large], "big.jpg", { type: "image/jpeg" });

  await assert.rejects(() => saveUpload(file), (error: unknown) => {
    assert.ok(error instanceof UploadError);
    assert.equal(error.errorKey, "errors.fileTooLarge");
    return true;
  });
});

test("saveDataUrl rejects invalid data URL", async () => {
  await assert.rejects(() => saveDataUrl("not-an-image"), (error: unknown) => {
    assert.ok(error instanceof UploadError);
    assert.equal(error.errorKey, "errors.invalidImage");
    return true;
  });
});

test("saveDataUrl saves valid base64 image", async () => {
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const savedPath = await saveDataUrl(tinyPng);
  assert.match(savedPath, /^\/uploads\/.+\.png$/);

  const filename = savedPath.replace("/uploads/", "");
  await rm(path.join(UPLOAD_DIR, filename), { force: true });
});

test("saveUpload saves valid jpg file", async () => {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const file = new File([Buffer.from("fake-jpg")], "photo.jpg", {
    type: "image/jpeg",
  });
  const savedPath = await saveUpload(file);
  assert.match(savedPath, /^\/uploads\/.+\.jpg$/);

  const filename = savedPath.replace("/uploads/", "");
  await rm(path.join(UPLOAD_DIR, filename), { force: true });
});
