// Genesis Studio Service Worker — PWA support
const CACHE_NAME = "genesis-v2";
const STATIC_ASSETS = ["/", "/dashboard", "/generate"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Skip non-GET, API calls, and external URLs (videos, media, CDN assets)
  if (
    event.request.method !== "GET" ||
    url.includes("/api/") ||
    !url.startsWith(self.location.origin) // Only cache same-origin requests
  ) {
    return;
  }

  // Skip media files — never cache videos/audio
  if (url.match(/\.(mp4|webm|mov|mp3|wav|ogg)$/i)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification support
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Genesis Studio";
  const options = {
    body: data.body || "Your video is ready!",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/gallery" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/gallery";
  event.waitUntil(clients.openWindow(url));
});
