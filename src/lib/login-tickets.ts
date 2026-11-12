type Ticket = {
  token: string;
  expiresAt: number;
  consumedAt: number | null;
};

const globalStore = globalThis as unknown as {
  __expire365LoginTickets?: Map<string, Ticket>;
};

function tickets(): Map<string, Ticket> {
  if (!globalStore.__expire365LoginTickets) {
    globalStore.__expire365LoginTickets = new Map();
  }
  return globalStore.__expire365LoginTickets;
}

const TTL_MS = 120_000;
/** Phones may hit establish twice; allow short reuse after first consume. */
const CONSUME_GRACE_MS = 15_000;

function prune() {
  const now = Date.now();
  for (const [id, ticket] of tickets()) {
    if (ticket.expiresAt <= now) {
      tickets().delete(id);
      continue;
    }
    if (
      ticket.consumedAt != null &&
      now - ticket.consumedAt > CONSUME_GRACE_MS
    ) {
      tickets().delete(id);
    }
  }
}

function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Short opaque code → session JWT (in-process). Used by login-form →
 * /auth/establish only (Node). Do not resolve these in Edge middleware.
 */
export function createLoginTicket(sessionToken: string): string {
  prune();
  const id = newId();
  tickets().set(id, {
    token: sessionToken,
    expiresAt: Date.now() + TTL_MS,
    consumedAt: null,
  });
  return id;
}

/**
 * Resolve a ticket. First use marks consumed; same id reusable briefly.
 */
export function resolveLoginTicket(id: string): string | null {
  prune();
  const ticket = tickets().get(id);
  if (!ticket) return null;
  const now = Date.now();
  if (ticket.expiresAt <= now) {
    tickets().delete(id);
    return null;
  }
  if (ticket.consumedAt == null) {
    ticket.consumedAt = now;
    return ticket.token;
  }
  if (now - ticket.consumedAt <= CONSUME_GRACE_MS) {
    return ticket.token;
  }
  tickets().delete(id);
  return null;
}

export function clearLoginTicket(id: string): void {
  tickets().delete(id);
}
