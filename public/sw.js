/**
 * expire365-v21 — inert worker.
 * Older workers cached HTML and broke phone login. This build only clears
 * old caches and unregisters; it never intercepts requests or forces reloads
 * (forced navigate caused white screens on phones).
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }
      await self.clients.claim();
    })(),
  );
});
