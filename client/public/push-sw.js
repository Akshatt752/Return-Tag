// Loaded into the generated service worker via workbox.importScripts (see vite.config.js).
// The server sends JSON payloads shaped { title, body, url }.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ReturnTag";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "You have a new update.",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { url: data.url || "/dashboard" },
      tag: data.url || "returntag",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      const sameOrigin = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin && "navigate" in sameOrigin) {
        return sameOrigin.navigate(target).then((client) => client?.focus());
      }
      return self.clients.openWindow(target);
    })
  );
});
