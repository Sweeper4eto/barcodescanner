import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { MessageKey } from "@/i18n";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export class UploadError extends Error {
  constructor(public readonly errorKey: MessageKey) {
    super(errorKey);
  }
}

export async function saveUpload(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (!allowed.has(ext)) {
    throw new UploadError("errors.invalidFileFormat");
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new UploadError("errors.fileTooLarge");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export async function saveDataUrl(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) {
    throw new UploadError("errors.invalidImage");
  }

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > 5 * 1024 * 1024) {
    throw new UploadError("errors.fileTooLarge");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}
