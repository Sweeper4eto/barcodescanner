/** Shared display helpers for admin + owner activity log UIs. */

export function extractAuditStoreName(details: string): string | null {
  const match = /store "([^"]+)"/.exec(details);
  const name = match?.[1]?.trim();
  return name || null;
}

export function formatAuditCompactWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${min}`;
}

/** YYYY-MM-DD → DD.MM.YYYY (leave other text alone). */
export function formatAuditDateDisplay(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function asYmd(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? null;
}

const HIDDEN_TOKEN =
  /^(barcode|article|артикул|sku|ean|plu)(\s|:|$)/i;
const STORE_TOKEN = /^store\s+"/i;
const PRODUCT_TITLE =
  /^(?:product|buy list|removed(?:\s+buy list)?|price reduced for|price reduction cleared for)\s+"([^"]*)"$/i;

export type AuditGoodsMeta = {
  key: "qty" | "expires" | "discount" | "other";
  value: string;
};

export type AuditGoodsDetails = {
  /** True when details look like inventory / buy-list / product stock. */
  isGoods: boolean;
  title: string | null;
  meta: AuditGoodsMeta[];
  /** Simple qty for the expiry-style badge; null when only a text change. */
  quantity: number | null;
  /** Complex qty text (e.g. "1 → 3" / "1 → total 4"). */
  quantityText: string | null;
  /** Primary expiry as YYYY-MM-DD for urgency + date formatting. */
  expiryYmd: string | null;
  /** When expiry is a change range, display this instead of a single day. */
  expiryText: string | null;
  discount: string | null;
  /** Non-goods or unparsed leftover text (barcode/article already stripped). */
  fallback: string | null;
};

function isHiddenPart(part: string): boolean {
  const trimmed = part.trim();
  if (HIDDEN_TOKEN.test(trimmed)) return true;
  if (/^barcode\b/i.test(trimmed)) return true;
  if (/^barcode\s*.*→/i.test(trimmed)) return true;
  if (/inventory barcode synced/i.test(trimmed)) return true;
  return false;
}

function expandParts(details: string): string[] {
  const top = details
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of top) {
    const changes = /^changes:\s*(.+)$/i.exec(part);
    if (changes?.[1]) {
      out.push(
        ...changes[1]
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      continue;
    }
    out.push(part);
  }
  return out;
}

function parseMeta(part: string): AuditGoodsMeta | null {
  const qty = /^qty\s+(.+)$/i.exec(part);
  if (qty?.[1]) {
    return { key: "qty", value: qty[1].trim() };
  }
  const added = /^added\s+(.+)$/i.exec(part);
  if (added?.[1]) {
    return { key: "qty", value: added[1].trim() };
  }
  const expires = /^expires\s+(.+)$/i.exec(part);
  if (expires?.[1]) {
    return { key: "expires", value: expires[1].trim() };
  }
  const discount = /^discount\s+(.+)$/i.exec(part);
  if (discount?.[1]) {
    return { key: "discount", value: discount[1].trim() };
  }
  const writeOff = /^write-off\s+(\d+)$/i.exec(part);
  if (writeOff?.[1]) {
    return { key: "other", value: `write-off ${writeOff[1]}` };
  }
  const namedChange = /^(name|qty|expires|image)\s+(.+)$/i.exec(part);
  if (namedChange?.[1] && namedChange[2]) {
    const label = namedChange[1].toLowerCase();
    if (label === "qty") return { key: "qty", value: namedChange[2].trim() };
    if (label === "expires") {
      return { key: "expires", value: namedChange[2].trim() };
    }
    return { key: "other", value: namedChange[2].trim() };
  }
  if (/^(with image|no image|image updated)$/i.test(part)) {
    return { key: "other", value: part };
  }
  return null;
}

function summarizeQty(value: string): {
  quantity: number | null;
  quantityText: string | null;
} {
  const plain = /^(\d+)$/.exec(value);
  if (plain) {
    return { quantity: Number(plain[1]), quantityText: null };
  }
  const total = /total\s+(\d+)\s*$/i.exec(value);
  if (total) {
    return { quantity: Number(total[1]), quantityText: value };
  }
  const arrow = /(\d+)\s*→\s*(\d+)\s*$/.exec(value);
  if (arrow) {
    return { quantity: Number(arrow[2]), quantityText: value };
  }
  return { quantity: null, quantityText: value };
}

function summarizeExpiry(value: string): {
  expiryYmd: string | null;
  expiryText: string | null;
} {
  const arrow = /^(.+?)\s*→\s*(.+)$/.exec(value);
  if (arrow) {
    const after = asYmd(arrow[2]!.trim()) ?? arrow[2]!.trim();
    return {
      expiryYmd: asYmd(after),
      expiryText: `${formatAuditDateDisplay(arrow[1]!.trim())} → ${formatAuditDateDisplay(arrow[2]!.trim())}`,
    };
  }
  const ymd = asYmd(value);
  return {
    expiryYmd: ymd,
    expiryText: ymd ? null : formatAuditDateDisplay(value),
  };
}

function emptyGoods(fallback: string | null = null): AuditGoodsDetails {
  return {
    isGoods: false,
    title: null,
    meta: [],
    quantity: null,
    quantityText: null,
    expiryYmd: null,
    expiryText: null,
    discount: null,
    fallback,
  };
}

/**
 * Structure inventory / buy-list style audit details for owner UI.
 * Hides barcode / article / SKU tokens; store is omitted (shown in the row header).
 */
export function parseAuditGoodsDetails(details: string): AuditGoodsDetails {
  const trimmed = details.trim();
  if (!trimmed) return emptyGoods(null);

  const parts = expandParts(trimmed);
  let title: string | null = null;
  const meta: AuditGoodsMeta[] = [];
  const leftover: string[] = [];
  let sawGoodsHint = false;

  for (const part of parts) {
    if (isHiddenPart(part) || STORE_TOKEN.test(part)) {
      if (HIDDEN_TOKEN.test(part) || /^barcode\b/i.test(part)) {
        sawGoodsHint = true;
      }
      continue;
    }

    const titleMatch = PRODUCT_TITLE.exec(part);
    if (titleMatch) {
      sawGoodsHint = true;
      const name = titleMatch[1]?.trim() ?? "";
      if (name) title = name;
      continue;
    }

    const parsed = parseMeta(part);
    if (parsed) {
      sawGoodsHint = true;
      meta.push(parsed);
      continue;
    }

    leftover.push(part);
  }

  const isGoods =
    sawGoodsHint ||
    Boolean(title) ||
    meta.some((item) => item.key === "qty" || item.key === "expires");

  if (!isGoods) {
    const cleaned = parts.filter((part) => !isHiddenPart(part)).join(" · ");
    return emptyGoods(cleaned || null);
  }

  let quantity: number | null = null;
  let quantityText: string | null = null;
  let expiryYmd: string | null = null;
  let expiryText: string | null = null;
  let discount: string | null = null;
  const extra: string[] = [...leftover];

  for (const item of meta) {
    if (item.key === "qty") {
      const summarized = summarizeQty(item.value);
      quantity = summarized.quantity;
      quantityText = summarized.quantityText;
      continue;
    }
    if (item.key === "expires") {
      const summarized = summarizeExpiry(item.value);
      expiryYmd = summarized.expiryYmd;
      expiryText = summarized.expiryText;
      continue;
    }
    if (item.key === "discount") {
      discount = item.value;
      continue;
    }
    extra.push(item.value);
  }

  return {
    isGoods: true,
    title,
    meta,
    quantity,
    quantityText,
    expiryYmd,
    expiryText,
    discount,
    fallback: extra.length ? extra.join(" · ") : null,
  };
}
