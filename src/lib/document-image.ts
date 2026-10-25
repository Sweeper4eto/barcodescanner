/**
 * Browser-side document photo quality checks and OCR preprocess.
 * No Node APIs - safe to import from client components.
 */

export type DocumentPhotoQuality =
  | { ok: true }
  | {
      ok: false;
      reason: "blurry" | "glare" | "tooDark" | "tooSmall";
    };

const ANALYSIS_MAX_EDGE = 640;

function loadBitmap(dataUrl: string): Promise<ImageBitmap> {
  return fetch(dataUrl)
    .then((response) => response.blob())
    .then((blob) =>
      createImageBitmap(blob, {
        imageOrientation: "from-image",
      }),
    );
}

function drawScaled(
  bitmap: ImageBitmap,
  maxEdge: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not prepare photo");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, ctx };
}

function toGray(data: Uint8ClampedArray, index: number): number {
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

function laplacianVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      const c = toGray(data, i);
      const up = toGray(data, ((y - 1) * width + x) * 4);
      const down = toGray(data, ((y + 1) * width + x) * 4);
      const left = toGray(data, (y * width + (x - 1)) * 4);
      const right = toGray(data, (y * width + (x + 1)) * 4);
      const lap = up + down + left + right - 4 * c;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export async function assessDocumentPhotoQuality(
  dataUrl: string,
): Promise<DocumentPhotoQuality> {
  const bitmap = await loadBitmap(dataUrl);
  try {
    if (Math.min(bitmap.width, bitmap.height) < 400) {
      return { ok: false, reason: "tooSmall" };
    }

    const { ctx, canvas } = drawScaled(bitmap, ANALYSIS_MAX_EDGE);
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    let brightnessSum = 0;
    let nearWhite = 0;
    const total = width * height;
    for (let i = 0; i < data.length; i += 4) {
      const gray = toGray(data, i);
      brightnessSum += gray;
      if (gray >= 248) nearWhite += 1;
    }
    const meanBrightness = brightnessSum / total;
    const whiteRatio = nearWhite / total;
    const sharpness = laplacianVariance(data, width, height);

    if (meanBrightness < 55) return { ok: false, reason: "tooDark" };
    if (whiteRatio > 0.22 && meanBrightness > 200) {
      return { ok: false, reason: "glare" };
    }
    if (sharpness < 45) return { ok: false, reason: "blurry" };

    return { ok: true };
  } finally {
    bitmap.close();
  }
}

type CropBounds = { x0: number; y0: number; x1: number; y1: number };

/** Ink bounding box — trims empty margins when the page already fills the frame. */
function inkBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): CropBounds | null {
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gray = toGray(data, (y * width + x) * 4);
      if (gray < 230) {
        found = true;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }

  if (!found) return null;
  const padX = Math.max(4, Math.round(width * 0.02));
  const padY = Math.max(4, Math.round(height * 0.02));
  return {
    x0: Math.max(0, x0 - padX),
    y0: Math.max(0, y0 - padY),
    x1: Math.min(width - 1, x1 + padX),
    y1: Math.min(height - 1, y1 + padY),
  };
}

function regionMeanGray(
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      sum += toGray(data, (y * width + x) * 4);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function longestCoverRun(
  cover: Float64Array,
  minCover: number,
): { start: number; end: number } | null {
  let bestStart = 0;
  let bestEnd = -1;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i <= cover.length; i += 1) {
    const ok = i < cover.length && cover[i] >= minCover;
    if (ok) {
      if (runStart < 0) runStart = i;
      continue;
    }
    if (runStart >= 0) {
      const len = i - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
        bestEnd = i - 1;
      }
      runStart = -1;
    }
  }
  if (bestEnd < bestStart) return null;
  return { start: bestStart, end: bestEnd };
}

/**
 * Find the bright page rectangle so gallery shots on a dark table crop like
 * an in-app viewfinder still (page fills the OCR frame).
 * Returns null when the page already fills most of the frame.
 * Exported for unit tests.
 */
export function paperBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): CropBounds | null {
  const corner = Math.max(4, Math.round(Math.min(width, height) * 0.08));
  const cornerMean =
    (regionMeanGray(data, width, 0, 0, corner, corner) +
      regionMeanGray(data, width, width - corner, 0, width, corner) +
      regionMeanGray(data, width, 0, height - corner, corner, height) +
      regionMeanGray(
        data,
        width,
        width - corner,
        height - corner,
        width,
        height,
      )) /
    4;
  const centerMean = regionMeanGray(
    data,
    width,
    Math.floor(width * 0.3),
    Math.floor(height * 0.3),
    Math.floor(width * 0.7),
    Math.floor(height * 0.7),
  );

  // No clear page-vs-table split (Retake already fills the frame, or white desk).
  if (centerMean - cornerMean < 30) return null;

  const paperThresh = Math.min(
    200,
    Math.max(140, cornerMean + (centerMean - cornerMean) * 0.35),
  );

  const rowCover = new Float64Array(height);
  const colCover = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    let paper = 0;
    for (let x = 0; x < width; x += 1) {
      if (toGray(data, (y * width + x) * 4) >= paperThresh) {
        paper += 1;
        colCover[x] += 1;
      }
    }
    rowCover[y] = paper / width;
  }
  for (let x = 0; x < width; x += 1) colCover[x] /= height;

  // Text makes paper rows only partly bright; table rows stay near 0.
  const minCover = 0.16;
  const rowRun = longestCoverRun(rowCover, minCover);
  const colRun = longestCoverRun(colCover, minCover);
  if (!rowRun || !colRun) return null;

  const x0 = colRun.start;
  const x1 = colRun.end;
  const y0 = rowRun.start;
  const y1 = rowRun.end;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  if (bw < width * 0.35 || bh < height * 0.35) return null;
  if (bw * bh >= width * height * 0.92) return null;

  const padX = Math.max(4, Math.round(width * 0.015));
  const padY = Math.max(4, Math.round(height * 0.015));
  return {
    x0: Math.max(0, x0 - padX),
    y0: Math.max(0, y0 - padY),
    x1: Math.min(width - 1, x1 + padX),
    y1: Math.min(height - 1, y1 + padY),
  };
}

function pickCropBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): CropBounds | null {
  const paper = paperBounds(data, width, height);
  if (paper) return paper;

  // Ink trim only when the page already fills the frame. On a dark table,
  // inkBounds would expand to the table again (the bug we are fixing).
  const corner = Math.max(4, Math.round(Math.min(width, height) * 0.08));
  const cornerMean =
    (regionMeanGray(data, width, 0, 0, corner, corner) +
      regionMeanGray(data, width, width - corner, 0, width, corner) +
      regionMeanGray(data, width, 0, height - corner, corner, height) +
      regionMeanGray(
        data,
        width,
        width - corner,
        height - corner,
        width,
        height,
      )) /
    4;
  const centerMean = regionMeanGray(
    data,
    width,
    Math.floor(width * 0.3),
    Math.floor(height * 0.3),
    Math.floor(width * 0.7),
    Math.floor(height * 0.7),
  );
  if (centerMean - cornerMean < 30) return inkBounds(data, width, height);
  return null;
}

function rowProjectionScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const rowInk = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    for (let x = 0; x < width; x += 1) {
      if (toGray(data, (y * width + x) * 4) < 200) ink += 1;
    }
    rowInk[y] = ink;
  }
  let mean = 0;
  for (let y = 0; y < height; y += 1) mean += rowInk[y];
  mean /= height;
  let variance = 0;
  for (let y = 0; y < height; y += 1) {
    const d = rowInk[y] - mean;
    variance += d * d;
  }
  return variance / height;
}

function estimateSkewDegrees(source: HTMLCanvasElement): number {
  const probe = document.createElement("canvas");
  const maxEdge = 480;
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  probe.width = Math.max(1, Math.round(source.width * scale));
  probe.height = Math.max(1, Math.round(source.height * scale));
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) return 0;
  pctx.drawImage(source, 0, 0, probe.width, probe.height);

  let bestAngle = 0;
  let bestScore = -1;
  for (let angle = -3; angle <= 3; angle += 0.5) {
    const rotated = document.createElement("canvas");
    rotated.width = probe.width;
    rotated.height = probe.height;
    const rctx = rotated.getContext("2d", { willReadFrequently: true });
    if (!rctx) continue;
    rctx.translate(probe.width / 2, probe.height / 2);
    rctx.rotate((angle * Math.PI) / 180);
    rctx.drawImage(probe, -probe.width / 2, -probe.height / 2);
    const sample = rctx.getImageData(0, 0, probe.width, probe.height);
    const score = rowProjectionScore(sample.data, probe.width, probe.height);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }
  return Math.abs(bestAngle) < 0.25 ? 0 : bestAngle;
}

function sharpenInPlace(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const v =
          -copy[((y - 1) * width + x) * 4 + c] -
          copy[(y * width + (x - 1)) * 4 + c] +
          5 * copy[i + c] -
          copy[(y * width + (x + 1)) * 4 + c] -
          copy[((y + 1) * width + x) * 4 + c];
        data[i + c] = Math.max(0, Math.min(255, v));
      }
    }
  }
}

function enhanceContrastInPlace(data: Uint8ClampedArray): void {
  const contrast = 1.12;
  for (let i = 0; i < data.length; i += 4) {
    const gray = toGray(data, i);
    const boosted = Math.min(
      255,
      Math.max(0, (gray - 128) * contrast + 128),
    );
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }
}

function applyDocumentEnhance(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  enhanceContrastInPlace(imageData.data);
  sharpenInPlace(imageData.data, width, height);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Crop the page first (so 12MP gallery shots don't waste the long edge on the
 * table), then scale that region up to maxEdge — same effective framing as Retake.
 */
function cropAndDeskew(
  bitmap: ImageBitmap,
  maxEdge: number,
): { canvas: HTMLCanvasElement; sourceMaxEdge: number } {
  const probeMax = ANALYSIS_MAX_EDGE;
  const probeScale = Math.min(
    1,
    probeMax / Math.max(bitmap.width, bitmap.height),
  );
  const probeW = Math.max(1, Math.round(bitmap.width * probeScale));
  const probeH = Math.max(1, Math.round(bitmap.height * probeScale));
  const probe = document.createElement("canvas");
  probe.width = probeW;
  probe.height = probeH;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) throw new Error("Could not prepare photo");
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(bitmap, 0, 0, probeW, probeH);

  const sample = pctx.getImageData(0, 0, probeW, probeH);
  const bounds = pickCropBounds(sample.data, probeW, probeH);

  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (bounds) {
    const bw = bounds.x1 - bounds.x0 + 1;
    const bh = bounds.y1 - bounds.y0 + 1;
    if (bw * bh < probeW * probeH * 0.92 && bw > 40 && bh > 40) {
      const inv = 1 / probeScale;
      sx = Math.max(0, Math.round(bounds.x0 * inv));
      sy = Math.max(0, Math.round(bounds.y0 * inv));
      sw = Math.min(bitmap.width - sx, Math.round(bw * inv));
      sh = Math.min(bitmap.height - sy, Math.round(bh * inv));
      if (sw < 40 || sh < 40) {
        sx = 0;
        sy = 0;
        sw = bitmap.width;
        sh = bitmap.height;
      }
    }
  }

  const sourceMaxEdge = Math.max(sw, sh);
  const scale = Math.min(1, maxEdge / sourceMaxEdge);
  const targetWidth = Math.max(1, Math.round(sw * scale));
  const targetHeight = Math.max(1, Math.round(sh * scale));

  const base = document.createElement("canvas");
  base.width = targetWidth;
  base.height = targetHeight;
  const bctx = base.getContext("2d", { willReadFrequently: true });
  if (!bctx) throw new Error("Could not prepare photo");
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

  const angle = estimateSkewDegrees(base);
  if (angle === 0) return { canvas: base, sourceMaxEdge };

  const rotated = document.createElement("canvas");
  rotated.width = base.width;
  rotated.height = base.height;
  const rctx = rotated.getContext("2d");
  if (!rctx) return { canvas: base, sourceMaxEdge };
  rctx.fillStyle = "#ffffff";
  rctx.fillRect(0, 0, rotated.width, rotated.height);
  rctx.translate(rotated.width / 2, rotated.height / 2);
  rctx.rotate((angle * Math.PI) / 180);
  rctx.drawImage(base, -base.width / 2, -base.height / 2);
  return { canvas: rotated, sourceMaxEdge };
}

function approxJpegBytes(dataUrl: string): number {
  return Math.floor(((dataUrl.length - 23) * 3) / 4);
}

export async function prepareDocumentImage(dataUrl: string): Promise<string> {
  // Keep enough resolution for small Godnost digits; avoid crushing to 1280.
  // Full crop/skew/sharpen runs at most 3 times — more passes froze multi-page
  // Retake on phones before the OCR request left the device.
  const TARGET_BYTES = 3_200_000;
  const STEPS = [
    { maxEdge: 3200, quality: 0.92 },
    { maxEdge: 2880, quality: 0.9 },
    { maxEdge: 2560, quality: 0.88 },
  ];

  const blob = await fetch(dataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "from-image",
  });

  try {
    let best = dataUrl;
    for (const step of STEPS) {
      const { canvas: enhanced, sourceMaxEdge } = cropAndDeskew(
        bitmap,
        step.maxEdge,
      );
      const ctx = enhanced.getContext("2d");
      if (!ctx) throw new Error("Could not prepare photo");
      applyDocumentEnhance(ctx);
      best = enhanced.toDataURL("image/jpeg", step.quality);
      if (approxJpegBytes(best) <= TARGET_BYTES) {
        return best;
      }
      // Cropped page already fits this maxEdge; smaller maxEdge won't shrink it.
      if (sourceMaxEdge <= step.maxEdge) break;
    }
    return best;
  } finally {
    bitmap.close();
  }
}
