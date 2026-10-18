import {
  daysUntilExpiry,
  formatLocaleDay,
  formatLocaleTime,
} from "@/lib/expiry";
import { pictureSaveStatus, readIosSaveTarget } from "@/lib/picture-save";

/** One JPG stays readable in chat apps past this many rows. */
export const EXPIRY_EXPORT_MAX_ITEMS = 20;

export type ExpiryExportDecision = "empty" | "too-many" | "ok";

export function expiryExportDecision(count: number): ExpiryExportDecision {
  if (count <= 0) return "empty";
  if (count > EXPIRY_EXPORT_MAX_ITEMS) return "too-many";
  return "ok";
}

export type ExpiryExportItem = {
  name: string;
  enteredAt: string;
  expiryDate: string;
  quantity: number;
};

export type ExpiryExportLabels = {
  title: string;
  storeLine: string;
  addedPrefix: string;
  validUntil: string;
  pieces: string;
  day: string;
  days: string;
  today: string;
  onlySelected: string;
};

export type ExpiryExportResult =
  | { status: "saved" }
  | { status: "preview"; url: string; filename: string }
  | { status: "failed" };

const LOGO_SRC = "/landing/brand-mark.png?v=3";
const SCALE = 2;
const WIDTH = 420;
const FONT = 'system-ui, "Segoe UI", sans-serif';

const COLOR = {
  background: "#09090b",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  border: "#3f3f46",
  primary: "#34d399",
  primarySoft: "rgba(52, 211, 153, 0.8)",
  critical: "#f87171",
  criticalBg: "#450a0a",
  warning: "#fde68a",
  warningBorder: "#facc15",
  warningBg: "#422006",
  soonBg: "rgba(16, 185, 129, 0.14)",
} as const;

let logoImage: HTMLImageElement | null = null;

export function preloadExpiryExportLogo(): void {
  if (typeof window === "undefined") return;
  const ready = resolveLogo();
  if (ready) {
    logoImage = ready;
    return;
  }
  if (logoImage) return;
  const img = new Image();
  img.onload = () => {
    logoImage = img;
  };
  img.src = LOGO_SRC;
}

function resolveLogo(): HTMLImageElement | null {
  if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    return logoImage;
  }
  if (typeof document === "undefined") return null;
  const existing = document.querySelector('img[src*="brand-mark"]');
  if (
    existing instanceof HTMLImageElement &&
    existing.complete &&
    existing.naturalWidth > 0
  ) {
    logoImage = existing;
    return existing;
  }
  return null;
}

type Urgency = "critical" | "warning" | "soon" | "normal";

function urgencyOf(days: number): Urgency {
  if (days <= 7) return "critical";
  if (days <= 14) return "warning";
  if (days <= 28) return "soon";
  return "normal";
}

function urgencyColors(urgency: Urgency): {
  stripe: string;
  border: string;
  bg: string;
  text: string;
} {
  if (urgency === "critical") {
    return {
      stripe: COLOR.critical,
      border: COLOR.critical,
      bg: COLOR.criticalBg,
      text: COLOR.critical,
    };
  }
  if (urgency === "warning") {
    return {
      stripe: COLOR.warningBorder,
      border: COLOR.warningBorder,
      bg: COLOR.warningBg,
      text: COLOR.warning,
    };
  }
  if (urgency === "soon") {
    return {
      stripe: COLOR.primary,
      border: COLOR.primary,
      bg: COLOR.soonBg,
      text: COLOR.foreground,
    };
  }
  return {
    stripe: COLOR.border,
    border: COLOR.border,
    bg: "transparent",
    text: COLOR.foreground,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";

  const fits = (value: string) => ctx.measureText(value).width <= maxWidth;

  const clip = (value: string) => {
    const ellipsis = "…";
    let cut = value;
    while (cut.length > 1 && !fits(`${cut}${ellipsis}`)) {
      cut = cut.slice(0, -1);
    }
    return `${cut}${ellipsis}`;
  };

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const next = current ? `${current} ${word}` : word;
    if (fits(next)) {
      current = next;
      continue;
    }
    const lastLine = lines.length === maxLines - 1;
    if (!current) {
      lines.push(lastLine ? clip(word) : clip(word).replace(/…$/, ""));
      if (lines.length === maxLines) return lines;
      continue;
    }
    if (lastLine) {
      lines.push(clip(`${current} ${word}`));
      return lines;
    }
    lines.push(current);
    current = fits(word) ? word : clip(word).replace(/…$/, "");
  }
  if (current) {
    if (lines.length === maxLines) {
      lines[maxLines - 1] = clip(lines[maxLines - 1] ?? current);
    } else {
      lines.push(fits(current) ? current : clip(current));
    }
  }
  return lines.slice(0, maxLines);
}

type RowLayout = {
  item: ExpiryExportItem;
  nameLines: string[];
  addedLine: string;
  untilLabel: string;
  untilDate: string;
  quantity: string;
  days: number;
  daysLabel: string;
  height: number;
};

function layoutRows(
  ctx: CanvasRenderingContext2D,
  items: ExpiryExportItem[],
  labels: ExpiryExportLabels,
  locale: string,
  textWidth: number,
): RowLayout[] {
  return items.map((item) => {
    ctx.font = `600 14px ${FONT}`;
    const nameLines = wrapLines(ctx, item.name, textWidth, 2);
    const entered = formatLocaleDay(item.enteredAt, locale);
    const expiry = formatLocaleDay(item.expiryDate, locale);
    const days = daysUntilExpiry(new Date(item.expiryDate));
    const abs = Math.abs(days);
    const daysLabel =
      days === 0 ? labels.today : abs === 1 ? labels.day : labels.days;
    const nameHeight = nameLines.length * 17;
    const height = Math.max(54, 8 + nameHeight + 2 + 13 + 16 + 8);
    return {
      item,
      nameLines,
      addedLine: `${labels.addedPrefix} ${entered}`,
      untilLabel: labels.validUntil,
      untilDate: expiry,
      quantity: String(item.quantity),
      days,
      daysLabel,
      height,
    };
  });
}

function drawExpiryCanvas(
  items: ExpiryExportItem[],
  labels: ExpiryExportLabels,
  locale: string,
  exportedAt: Date,
): HTMLCanvasElement {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("canvas-unavailable");

  const textWidth = WIDTH - 16 - 4 - 8 - 8 - 8 - 82;
  const rows = layoutRows(measure, items, labels, locale, textWidth);

  const headerHeight = 14 + 32 + 8 + 18 + 4 + 14 + 12;
  const listGap = 6;
  const listHeight =
    10 +
    rows.reduce((sum, row) => sum + row.height, 0) +
    Math.max(0, rows.length - 1) * listGap +
    8;
  const footerHeight = 36;
  const height = headerHeight + listHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(WIDTH * SCALE);
  canvas.height = Math.ceil(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = COLOR.background;
  ctx.fillRect(0, 0, WIDTH, height);

  const logo = resolveLogo();
  const logoSize = 32;
  const logoX = 14;
  const logoY = 14;
  if (logo) {
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `600 18px ${FONT}`;
  const wordX = logoX + logoSize + 8;
  const wordY = logoY + logoSize / 2;
  ctx.fillStyle = COLOR.foreground;
  ctx.fillText("expire", wordX, wordY);
  const expireWidth = ctx.measureText("expire").width;
  ctx.fillStyle = COLOR.primary;
  ctx.fillText("365", wordX + expireWidth, wordY);

  const stamp = `${formatLocaleDay(exportedAt, locale)} · ${formatLocaleTime(exportedAt, locale)}`;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = COLOR.muted;
  ctx.textAlign = "right";
  ctx.fillText(stamp, WIDTH - 14, wordY);

  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.foreground;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(labels.title, 14, logoY + logoSize + 8 + 9);

  ctx.fillStyle = COLOR.muted;
  ctx.font = `400 12px ${FONT}`;
  const storeLine = wrapLines(ctx, labels.storeLine, WIDTH - 28, 1)[0] ?? "";
  ctx.fillText(storeLine, 14, logoY + logoSize + 8 + 18 + 4 + 7);

  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(WIDTH, headerHeight);
  ctx.stroke();

  let y = headerHeight + 10;
  for (const row of rows) {
    drawRow(ctx, row, y, labels.pieces);
    y += row.height + listGap;
  }

  const footerTop = height - footerHeight;
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerTop);
  ctx.lineTo(WIDTH, footerTop);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.font = `400 11px ${FONT}`;
  ctx.fillStyle = COLOR.muted;
  ctx.textAlign = "left";
  ctx.fillText(labels.onlySelected, 14, footerTop + footerHeight / 2);
  ctx.textAlign = "right";
  ctx.font = `600 11px ${FONT}`;
  const footerY = footerTop + footerHeight / 2;
  const yearWidth = ctx.measureText("365").width;
  ctx.fillStyle = COLOR.primary;
  ctx.fillText("365", WIDTH - 14, footerY);
  ctx.fillStyle = COLOR.foreground;
  ctx.fillText("expire", WIDTH - 14 - yearWidth, footerY);

  return canvas;
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  row: RowLayout,
  y: number,
  pieces: string,
) {
  const x = 8;
  const width = WIDTH - 16;
  const colors = urgencyColors(urgencyOf(row.days));

  roundRect(ctx, x, y, width, row.height, 12);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = colors.stripe;
  ctx.fillRect(x, y, 4, row.height);
  ctx.restore();

  roundRect(ctx, x, y, width, row.height, 12);
  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const textX = x + 4 + 8;
  let textY = y + 8;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = COLOR.foreground;
  ctx.font = `600 14px ${FONT}`;
  for (const line of row.nameLines) {
    ctx.fillText(line, textX, textY);
    textY += 17;
  }
  textY += 2;
  ctx.fillStyle = COLOR.muted;
  ctx.font = `400 10px ${FONT}`;
  ctx.fillText(row.addedLine, textX, textY);
  textY += 13;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = COLOR.primarySoft;
  ctx.fillText(row.untilLabel, textX, textY + 1);
  const labelWidth = ctx.measureText(`${row.untilLabel} `).width;
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = COLOR.primary;
  ctx.fillText(row.untilDate, textX + labelWidth, textY);

  const boxW = 40;
  const boxH = 38;
  const boxY = y + (row.height - boxH) / 2;
  const daysX = x + width - 8 - boxW;
  const qtyX = daysX - 2 - boxW;
  drawCountBox(ctx, qtyX, boxY, boxW, boxH, row.quantity, pieces, {
    border: COLOR.border,
    bg: "transparent",
    text: COLOR.foreground,
    unit: COLOR.muted,
  });
  drawCountBox(
    ctx,
    daysX,
    boxY,
    boxW,
    boxH,
    row.days === 0 ? row.daysLabel : String(row.days),
    row.days === 0 ? "" : row.daysLabel,
    {
      border: colors.border,
      bg: colors.bg,
      text: colors.text,
      unit: colors.text,
    },
  );
}

function drawCountBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  unit: string,
  colors: { border: string; bg: string; text: string; unit: string },
) {
  roundRect(ctx, x, y, width, height, 6);
  if (colors.bg !== "transparent") {
    ctx.fillStyle = colors.bg;
    ctx.fill();
  }
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cx = x + width / 2;
  if (!unit) {
    ctx.fillStyle = colors.text;
    ctx.font = `700 10px ${FONT}`;
    ctx.fillText(value, cx, y + height / 2);
    return;
  }
  ctx.fillStyle = colors.text;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(value, cx, y + height / 2 - 6);
  ctx.fillStyle = colors.unit;
  ctx.font = `600 10px ${FONT}`;
  ctx.fillText(unit, cx, y + height / 2 + 8);
}

function canvasToJpegBlobSync(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("toDataURL-failed");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/jpeg" });
}

function jpgFilename(when: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    when.getFullYear(),
    pad(when.getMonth() + 1),
    pad(when.getDate()),
    pad(when.getHours()),
    pad(when.getMinutes()),
    pad(when.getSeconds()),
  ].join("");
  return `expiry-${stamp}.jpg`;
}

/** Write the jpeg into the phone's Downloads folder. No share sheet — that only copies. */
function triggerDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}

function deliverJpegBlob(blob: Blob, filename: string): ExpiryExportResult {
  // iOS ignores <a download> in Safari and installed web apps. Show the picture
  // so it can be saved to Photos. The share sheet only offered Copy.
  if (pictureSaveStatus(readIosSaveTarget(), true) === "preview") {
    return {
      status: "preview",
      url: URL.createObjectURL(blob),
      filename,
    };
  }
  const started = triggerDownload(blob, filename);
  return pictureSaveStatus(false, started) === "saved"
    ? { status: "saved" }
    : { status: "failed" };
}

/**
 * Draw the selected expiry rows to a JPEG and save it on the device.
 * Canvas work stays synchronous so the download stays inside the tap.
 */
export function downloadExpirySelectionJpg(input: {
  items: ExpiryExportItem[];
  labels: ExpiryExportLabels;
  locale: string;
  exportedAt?: Date;
}): ExpiryExportResult {
  if (typeof document === "undefined") return { status: "failed" };
  if (expiryExportDecision(input.items.length) !== "ok") return { status: "failed" };
  try {
    const exportedAt = input.exportedAt ?? new Date();
    const canvas = drawExpiryCanvas(
      input.items,
      input.labels,
      input.locale,
      exportedAt,
    );
    const blob = canvasToJpegBlobSync(canvas);
    return deliverJpegBlob(blob, jpgFilename(exportedAt));
  } catch {
    return { status: "failed" };
  }
}
