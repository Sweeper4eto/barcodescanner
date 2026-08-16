export type WhatsNewPublicItem = {
  id: string;
  title: string;
  href: string | null;
};

const SEEN_KEY = "expire365-whats-new-seen";

/** Fingerprint of the currently published set — changes when admin pushes/dismisses. */
export function whatsNewFingerprint(items: { id: string }[]): string {
  return items
    .map((item) => item.id)
    .sort()
    .join("|");
}

export function getWhatsNewSeenFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markWhatsNewSeen(fingerprint: string): void {
  try {
    window.localStorage.setItem(SEEN_KEY, fingerprint);
  } catch {
    // ignore quota / private mode
  }
}

export function shouldShowWhatsNew(
  items: { id: string }[],
  seenFingerprint: string | null = getWhatsNewSeenFingerprint(),
): boolean {
  if (items.length === 0) return false;
  return whatsNewFingerprint(items) !== seenFingerprint;
}