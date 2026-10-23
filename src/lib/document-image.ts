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
/** Enough for Godnost digits; higher + per-pixel sharpen froze Retake on phones. */
const PREPARE_MAX_EDGE = 2048;
const PREPARE_TARGET_BYTES = 2_000_000;

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

function approxJpegBytes(dataUrl: string): number {
  return Math.floor(((dataUrl.length - 23) * 3) / 4);
}

/**
 * Fast resize + JPEG for upload. No per-pixel sharpen/crop — those made Retake
 * feel hung for many seconds before any server OCR log appeared.
 */
export async function prepareDocumentImage(dataUrl: string): Promise<string> {
  const bitmap = await loadBitmap(dataUrl);

  try {
    const { canvas } = drawScaled(bitmap, PREPARE_MAX_EDGE);
    // Let the Retake spinner breathe on mid-range phones.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    const qualities = [0.88, 0.82, 0.76, 0.7];
    let best = canvas.toDataURL("image/jpeg", qualities[0]);
    for (const quality of qualities) {
      best = canvas.toDataURL("image/jpeg", quality);
      if (approxJpegBytes(best) <= PREPARE_TARGET_BYTES) {
        return best;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    return best;
  } finally {
    bitmap.close();
  }
}
