import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  deleteLocalUpload,
  isLocalUploadPath,
  isSafeUploadFilename,
  readUploadOwner,
  relocateLegacyUploads,
  resolveLocalUploadPath,
  saveDataUrl,
  UploadError,
} from "../src/lib/upload";

const legacyDir = path.join(process.cwd(), "public", "uploads");

test("isLocalUploadPath only accepts /uploads image filenames", () => {
  assert.equal(isLocalUploadPath("/uploads/a.jpg"), true);
  assert.equal(isLocalUploadPath("https://cdn.example/a.jpg"), false);
  assert.equal(isLocalUploadPath("/uploads/../secret"), false);
  assert.equal(isLocalUploadPath("/uploads/note.owner"), false);
  assert.equal(isLocalUploadPath(null), false);
  assert.equal(isSafeUploadFilename("a.jpg"), true);
  assert.equal(isSafeUploadFilename("a.owner"), false);
});

test("saveDataUrl writes a private file and an owner marker", async () => {
  const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const dataUrl = `data:image/jpeg;base64,${tinyJpeg.toString("base64")}`;
  const saved = await saveDataUrl(dataUrl, "user-1");
  assert.match(saved, /^\/uploads\/\d+-[a-f0-9]+\.jpg$/);

  const absolute = await resolveLocalUploadPath(saved);
  assert.ok(absolute);
  assert.equal(absolute!.startsWith(path.join(process.cwd(), "data", "uploads")), true);
  const bytes = await readFile(absolute!);
  assert.deepEqual(bytes, tinyJpeg);
  assert.equal(await readUploadOwner(saved.slice("/uploads/".length)), "user-1");
  assert.equal(await deleteLocalUpload(saved), true);
  await assert.rejects(() => access(absolute!));
  assert.equal(await readUploadOwner(saved.slice("/uploads/".length)), null);

  assert.equal(await deleteLocalUpload("https://images.example/a.jpg"), false);

  await assert.rejects(
    () => saveDataUrl("data:image/heic;base64,AAAA"),
    (error: unknown) =>
      error instanceof UploadError && error.errorKey === "errors.invalidImage",
  );
});

test("legacy public photos are moved out of the static folder", async () => {
  await mkdir(legacyDir, { recursive: true });
  const filename = `legacy-${Date.now()}.jpg`;
  const legacyFile = path.join(legacyDir, filename);
  await writeFile(legacyFile, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const before = await resolveLocalUploadPath(`/uploads/${filename}`);
  assert.equal(before, legacyFile);

  await relocateLegacyUploads();
  await assert.rejects(() => access(legacyFile));
  const after = await resolveLocalUploadPath(`/uploads/${filename}`);
  assert.ok(after);
  assert.equal(after!.startsWith(path.join(process.cwd(), "data", "uploads")), true);
  assert.equal(await deleteLocalUpload(`/uploads/${filename}`), true);
});
