/**
 * Server-side document deskew (rotation only).
 * Runs before OCR: detect small page tilt via row-ink projection, rotate only
 * when clearly tilted. Flat / uncertain photos are left unchanged.
 *
 * Node / sharp only — do not import from client components.
 */

import sharp from "sharp";

const PROBE_MAX_EDGE = 480;
/** Coarse sweep — phone sheets are often more than ±3°. */
const COARSE_MIN = -8;
const COARSE_MAX = 8;
const COARSE_STEP = 0.5;
const FINE_RADIUS = 0.5;
const FINE_STEP = 0.25;
/** Below this, treat as flat (do not rewrite the JPEG). */
const APPLY_MIN_ABS_DEGREES = 0.4;
/**
 * Best angle must beat the flat (0°) score by this ratio, otherwise leave as-is.
 * Without this, noisy pages often “won” at the ±8° search edge.
 */
const APPLY_MIN_SCORE_RATIO = 1.08;
const OUTPUT_JPEG_QUALITY = 90;

export type DocumentDeskewResult = {
  dataUrl: string;
  /** Detected skew in degrees (positive = clockwise for sharp.rotate). */
  angleDegrees: number;
  applied: boolean;
};

/** Opt-in: prod saw false ±8° “max tilt” hits when this defaulted on. */
function documentAiDeskewEnabled(): boolean {
  const raw = process.env.DOCUMENT_AI_DESKEW?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

export function parseDocumentDataUrl(dataUrl: string): {
  mime: string;
  buffer: Buffer;
} {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("INVALID_IMAGE");
  }
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

/** Higher score = text rows align better with horizontal scanlines. */
export function rowProjectionScore(
  gray: Uint8Array | Buffer,
  width: number,
  height: number,
  inkThreshold = 200,
): number {
  const rowInk = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      if (gray[rowStart + x]! < inkThreshold) ink += 1;
    }
    rowInk[y] = ink;
  }
  let mean = 0;
  for (let y = 0; y < height; y += 1) mean += rowInk[y]!;
  mean /= Math.max(1, height);
  let variance = 0;
  for (let y = 0; y < height; y += 1) {
    const d = rowInk[y]! - mean;
    variance += d * d;
  }
  return variance / Math.max(1, height);
}

async function scoreRotation(
  probe: Buffer,
  width: number,
  height: number,
  angle: number,
): Promise<number> {
  if (Math.abs(angle) < 1e-6) {
    return rowProjectionScore(probe, width, height);
  }
  const rotated = await sharp(probe, {
    raw: { width, height, channels: 1 },
  })
    .rotate(angle, { background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return rowProjectionScore(
    rotated.data,
    rotated.info.width,
    rotated.info.height,
  );
}

/**
 * Estimate 2D page skew in degrees. Returns 0 when flat or inconclusive.
 * Exported for unit tests.
 */
export async function estimateDocumentSkewDegrees(
  imageBuffer: Buffer,
): Promise<number> {
  const { data, info } = await sharp(imageBuffer)
    .rotate() // honour EXIF orientation first
    .resize({
      width: PROBE_MAX_EDGE,
      height: PROBE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const flatScore = await scoreRotation(data, width, height, 0);
  let bestAngle = 0;
  let bestScore = flatScore;

  for (let angle = COARSE_MIN; angle <= COARSE_MAX + 1e-9; angle += COARSE_STEP) {
    if (Math.abs(angle) < 1e-9) continue;
    const score = await scoreRotation(data, width, height, angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  const fineStart = bestAngle - FINE_RADIUS;
  const fineEnd = bestAngle + FINE_RADIUS;
  for (let angle = fineStart; angle <= fineEnd + 1e-9; angle += FINE_STEP) {
    if (Math.abs(angle - bestAngle) < 1e-9) continue;
    if (angle < COARSE_MIN - 0.01 || angle > COARSE_MAX + 0.01) continue;
    const score = await scoreRotation(data, width, height, angle);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  if (Math.abs(bestAngle) < APPLY_MIN_ABS_DEGREES) return 0;
  if (bestScore < flatScore * APPLY_MIN_SCORE_RATIO) return 0;
  // Snap near-zero fine results.
  return Math.round(bestAngle * 100) / 100;
}

/**
 * Deskew a document data URL when tilted. Returns the original when flat,
 * disabled, or on failure (caller should still OCR).
 */
export async function deskewDocumentDataUrl(
  dataUrl: string,
): Promise<DocumentDeskewResult> {
  if (!documentAiDeskewEnabled()) {
    return { dataUrl, angleDegrees: 0, applied: false };
  }

  const { buffer } = parseDocumentDataUrl(dataUrl);
  const angleDegrees = await estimateDocumentSkewDegrees(buffer);
  if (angleDegrees === 0) {
    return { dataUrl, angleDegrees: 0, applied: false };
  }

  // Apply the same corrective rotation that maximized horizontal row alignment.
  const out = await sharp(buffer)
    .rotate() // EXIF first
    .rotate(angleDegrees, { background: "#ffffff" })
    .jpeg({ quality: OUTPUT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    dataUrl: `data:image/jpeg;base64,${out.toString("base64")}`,
    angleDegrees,
    applied: true,
  };
}

/** Safe wrapper for OCR: never throws; logs and returns input on failure. */
export async function maybeDeskewDocumentDataUrl(
  dataUrl: string,
): Promise<string> {
  const started = Date.now();
  try {
    const result = await deskewDocumentDataUrl(dataUrl);
    const ms = Date.now() - started;
    if (result.applied) {
      console.log(
        `document AI deskew: rotated ${result.angleDegrees.toFixed(2)}° in ${ms}ms`,
      );
      return result.dataUrl;
    }
    if (ms >= 50) {
      console.log(`document AI deskew: skipped (flat/disabled) in ${ms}ms`);
    }
    return dataUrl;
  } catch (error) {
    console.warn(
      `document AI deskew: skipped after ${Date.now() - started}ms`,
      error instanceof Error ? error.message : error,
    );
    return dataUrl;
  }
}
