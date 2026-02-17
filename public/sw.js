/// Service Worker for Shower Tracker PWA

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the main app to show notifications
self.addEventListener("message", (event) => {
  const { type, title, body } = event.data || {};
  if (type === "SHOW_NOTIFICATION") {
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/icon",
        badge: "/icon",
        tag: "shower-status",
        renotify: true,
      })
    );
  }
});

// Handle notification click → focus or open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
