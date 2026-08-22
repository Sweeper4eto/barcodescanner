/**
 * expire365-v22 — push + cache cleanup only.
 * Does not cache pages or intercept fetches (that broke phone login).
 * Must stay registered: PushManager.subscribe needs an active worker.
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
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "expire365";
      let body = "";
      let url = "/app";

      try {
        const data = event.data ? event.data.json() : null;
        if (data && typeof data === "object") {
          if (typeof data.title === "string" && data.title.trim()) {
            title = data.title.trim();
          }
          if (typeof data.body === "string") body = data.body;
          if (typeof data.url === "string" && data.url.startsWith("/")) {
            url = data.url;
          }
        }
      } catch (_) {
        const text = event.data ? event.data.text() : "";
        if (text) body = text;
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        icon: "/icon.png",
        badge: "/icon.png",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const path =
    typeof raw === "string" && raw.startsWith("/") ? raw : "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(path);
            } catch (_) {
              /* ignore */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(path);
      }
    })(),
  );
});
