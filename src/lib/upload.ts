import { randomBytes } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import type { MessageKey } from "@/i18n";

/** Max size for user uploads (multipart file or data URL). Keep in sync with camera-capture picker check. */
export const MAX_UPLOAD_FILE_BYTES = 12 * 1024 * 1024;

const LEGACY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function directoryIsPublic(dir: string): boolean {
  const pub = path.resolve(process.cwd(), "public");
  const target = path.resolve(dir);
  return target === pub || target.startsWith(pub + path.sep);
}

/**
 * Photos live outside `public` so Next does not serve them to anonymous visitors.
 * `EXPIRE365_UPLOAD_DIR` is honored only when it is not inside `public`.
 */
function resolveUploadDir(): string {
  const configured = (
    process.env.EXPIRE365_UPLOAD_DIR ?? process.env.MAGAZIN_UPLOAD_DIR
  )?.trim();
  if (configured && !directoryIsPublic(configured)) return configured;
  return path.join(process.cwd(), "data", "uploads");
}

const UPLOAD_DIR = resolveUploadDir();

const IMAGE_NAME =
  /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/;

export class UploadError extends Error {
  constructor(public readonly errorKey: MessageKey) {
    super(errorKey);
  }
}

export function isSafeUploadFilename(filename: string): boolean {
  return filename === path.basename(filename) && IMAGE_NAME.test(filename);
}

export function isLocalUploadPath(value: string | null | undefined): boolean {
  if (!value || !value.startsWith("/uploads/")) return false;
  return isSafeUploadFilename(value.slice("/uploads/".length));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Move leftovers out of public/uploads so the static server cannot hand them out. */
export async function relocateLegacyUploads(): Promise<void> {
  if (path.resolve(UPLOAD_DIR) === path.resolve(LEGACY_UPLOAD_DIR)) return;
  let names: string[] = [];
  try {
    names = await readdir(LEGACY_UPLOAD_DIR);
  } catch {
    return;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  for (const name of names) {
    if (name === ".gitkeep") continue;
    if (!isSafeUploadFilename(name) && !name.endsWith(".owner")) continue;
    const from = path.join(LEGACY_UPLOAD_DIR, name);
    const to = path.join(UPLOAD_DIR, name);
    if (await fileExists(to)) {
      await unlink(from).catch(() => undefined);
      continue;
    }
    try {
      await rename(from, to);
    } catch {
      try {
        const bytes = await readFile(from);
        await writeFile(to, bytes);
        await unlink(from);
      } catch {
        // Leave the legacy file if both moves fail; the next boot retries.
      }
    }
  }
}

function candidatePaths(filename: string): string[] {
  return [
    path.join(UPLOAD_DIR, filename),
    path.join(LEGACY_UPLOAD_DIR, filename),
  ];
}

/** Resolve a /uploads/... path to a file on disk, or null. Ignores remote URLs. */
export async function resolveLocalUploadPath(
  imagePath: string | null | undefined,
): Promise<string | null> {
  if (!isLocalUploadPath(imagePath)) return null;
  const filename = imagePath!.slice("/uploads/".length);
  for (const candidate of candidatePaths(filename)) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function writeOwner(filename: string, userId: string): Promise<void> {
  const owner = userId.trim();
  if (!owner || owner.includes("\n") || owner.includes("\r")) return;
  await writeFile(path.join(UPLOAD_DIR, `${filename}.owner`), owner, "utf8");
}

/** User who uploaded this file before it was linked to a product or a store. */
export async function readUploadOwner(filename: string): Promise<string | null> {
  if (!isSafeUploadFilename(filename)) return null;
  for (const candidate of candidatePaths(`${filename}.owner`)) {
    try {
      const owner = (await readFile(candidate, "utf8")).trim();
      if (owner) return owner;
    } catch {
      // try the other directory
    }
  }
  return null;
}

/** Delete a local upload if it lives in the upload dirs. Ignores CDN URLs. */
export async function deleteLocalUpload(
  imagePath: string | null | undefined,
): Promise<boolean> {
  if (!isLocalUploadPath(imagePath)) return false;
  const filename = imagePath!.slice("/uploads/".length);
  let removed = false;
  for (const candidate of [
    ...candidatePaths(filename),
    ...candidatePaths(`${filename}.owner`),
  ]) {
    try {
      await unlink(candidate);
      removed = true;
    } catch {
      // already gone
    }
  }
  return removed;
}

async function writeUploadBytes(
  buffer: Buffer,
  ext: string,
  ownerUserId?: string | null,
): Promise<string> {
  await relocateLegacyUploads();
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${Date.now()}-${randomBytes(9).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  if (ownerUserId) await writeOwner(filename, ownerUserId);
  return `/uploads/${filename}`;
}

export async function saveUpload(
  file: File,
  ownerUserId?: string | null,
): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (!allowed.has(ext)) {
    throw new UploadError("errors.invalidFileFormat");
  }

  if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
    throw new UploadError("errors.fileTooLarge");
  }

  const storedExt = ext === "jpeg" ? "jpg" : ext;
  return writeUploadBytes(buffer, storedExt, ownerUserId);
}

const DATA_URL_EXT: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

export async function saveDataUrl(
  dataUrl: string,
  ownerUserId?: string | null,
): Promise<string> {
  const match = dataUrl.match(
    /^data:image\/([\w+-]+);(?:charset=[\w-]+;)?base64,(.+)$/,
  );
  if (!match) {
    throw new UploadError("errors.invalidImage");
  }

  const ext = DATA_URL_EXT[match[1].toLowerCase()];
  if (!ext) {
    throw new UploadError("errors.invalidImage");
  }
  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length > MAX_UPLOAD_FILE_BYTES) {
    throw new UploadError("errors.fileTooLarge");
  }

  return writeUploadBytes(buffer, ext, ownerUserId);
}

export async function saveUploadBuffer(
  buffer: Buffer,
  ext: string,
  ownerUserId?: string | null,
): Promise<string | null> {
  const stored = DATA_URL_EXT[ext] ?? (ext === "jpg" ? "jpg" : null);
  if (!stored) return null;
  if (!buffer.length || buffer.length > MAX_UPLOAD_FILE_BYTES) return null;
  return writeUploadBytes(buffer, stored, ownerUserId);
}
