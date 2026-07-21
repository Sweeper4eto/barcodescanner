const CACHE_NAME = "expire365-v10";
const OFFLINE_FALLBACKS = ["/app", "/login", "/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_FALLBACKS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/uploads/")) return;
  if (url.pathname.startsWith("/icons/")) return;
  if (url.pathname === "/favicon.ico") return;

  const isDocument =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isDocument) {
    // Network-first for navigations; fall back to cached shell when offline.
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match("/app") ||
              caches.match("/") ||
              caches.match("/login"),
          ),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok || response.type !== "basic") return response;
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  const fallback = { title: "expire365", body: "", url: "/app" };
  const data = event.data?.json() ?? fallback;

  // Do not set `icon` here: on Android PWAs Chrome already shows the app
  // icon, and a second `icon` makes two logos (often one stale + one new).
  event.waitUntil(
    self.registration.showNotification(data.title ?? fallback.title, {
      body: data.body ?? "",
      badge: "/icons/icon-192.png?v=4",
      data: { url: data.url ?? fallback.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/app";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});