import { setTestSessionToken } from "@/lib/session";

export function clearMockCookie(): void {
  setTestSessionToken(undefined);
}

export async function setMockSession(token: string): Promise<void> {
  setTestSessionToken(token);
}

export async function jsonRequest(
  handler: (request: Request) => Promise<Response>,
  init: RequestInit & { url?: string } = {},
) {
  const response = await handler(
    new Request(init.url ?? "http://localhost/api", init),
  );
  const data = await response.json().catch(() => null);
  return { response, data };
}
