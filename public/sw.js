// Service Worker - Sirvo PWA

const CACHE_NAME = "sirvo-v2";

const STATIC_ASSETS = ["/", "/index.html", "/favicon.ico", "/icons/icon-512.png"];

// ========================
// INSTALL
// ========================
self.addEventListener("install", (event) => {
  console.log("[SW] Installed");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );

  self.skipWaiting();
});

// ========================
// ACTIVATE
// ========================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");

  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log("[SW] Removing old cache:", cache);
              return caches.delete(cache);
            }
          }),
        );
      }),
      self.clients.claim(),
    ]),
  );
});

// ========================
// FETCH (Offline Support)
// ========================
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          return caches.match("/");
        })
      );
    }),
  );
});

// ========================
// PUSH NOTIFICATION
// ========================
self.addEventListener("push", (event) => {
  console.log("[SW] Push received");

  let payload = {
    title: "Sirvo",
    body: "Você tem uma nova notificação",
    icon: "/icons/icon-512.png",
    badge: "/icons/icon-512.png",
    url: "/dashboard",
    tag: "sirvo-notification",
  };

  try {
    if (event.data) {
      const data = event.data.json();

      payload = {
        ...payload,
        ...data,
      };
    }
  } catch (error) {
    console.error("[SW] Error parsing push payload:", error);
  }

  const options = {
    body: payload.body,

    icon: payload.icon || "/icons/icon-512.png",
    badge: payload.badge || "/icons/icon-512.png",

    data: {
      url: payload.url || "/dashboard",
    },

    vibrate: [100, 50, 100],

    tag: payload.tag || "sirvo-notification",
    renotify: true,

    requireInteraction: true,

    actions: [
      {
        action: "open",
        title: "Abrir",
      },
      {
        action: "close",
        title: "Fechar",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title || "Sirvo", options));
});

// ========================
// NOTIFICATION CLICK
// ========================
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");

  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});

// ========================
// NOTIFICATION CLOSE
// ========================
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification dismissed");
});

// ========================
// APP UPDATE MESSAGE
// ========================
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
