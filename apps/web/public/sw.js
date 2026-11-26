/* Croebet service worker: push delivery and notification focus, no caching. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* Use the generic body. */ }
  const title = typeof data.title === "string" && data.title ? data.title : "Croebet";
  const options = {
    body: typeof data.body === "string" && data.body ? data.body : "Sua vez.",
    icon: typeof data.icon === "string" && data.icon ? data.icon : "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: typeof data.tag === "string" && data.tag ? data.tag : "croebet",
    renotify: true,
    data: { url: typeof data.url === "string" && data.url ? data.url : "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) if (client.url === target && "focus" in client) return client.focus();
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
        await client.navigate(target);
        return client.focus?.();
      }
    }
    return self.clients.openWindow(target);
  })());
});
