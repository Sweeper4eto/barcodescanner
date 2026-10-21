/**
 * Sliding window rate limit for voice item parse only.
 * Intentionally separate from document OCR (`document-ocr-rate-limit.ts`)
 * so voice usage cannot block document scan, and vice versa.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PARSES = 60;

const buckets = new Map<string, number[]>();

function prune(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, stamps] of buckets) {
    const kept = stamps.filter((t) => now - t < WINDOW_MS);
    if (kept.length === 0) buckets.delete(key);
    else buckets.set(key, kept);
  }
}

function stampsInWindow(userId: string, now: number): number[] {
  const prev = buckets.get(userId) ?? [];
  return prev.filter((t) => now - t < WINDOW_MS);
}

/**
 * Record a voice parse attempt if under the limit.
 * @returns null when allowed, or retry-after ms when blocked.
 */
export function takeVoiceParseSlot(userId: string): number | null {
  const now = Date.now();
  prune(now);
  const stamps = stampsInWindow(userId, now);
  if (stamps.length >= MAX_PARSES) {
    const oldest = Math.min(...stamps);
    return Math.max(1, oldest + WINDOW_MS - now);
  }
  stamps.push(now);
  buckets.set(userId, stamps);
  return null;
}

export function resetVoiceRateLimitsForTests(): void {
  buckets.clear();
}
