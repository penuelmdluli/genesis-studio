// Genesis Studio Service Worker — PWA support
const SW_VERSION = "v3-2026-05-01";
const CACHE_NAME = "genesis-v3";
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
  // Skip non-GET requests — let the browser handle them natively.
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests — never cache external resources.
  if (url.origin !== self.location.origin) return;

  // Skip API calls — never cache dynamic data.
  if (url.pathname.startsWith("/api/")) return;

  // Skip media files — never cache videos/audio.
  if (/\.(mp4|webm|mov|mp3|wav|ogg)$/i.test(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || new Response("Offline", { status: 503 }))
      )
  );
});

// Push notification support
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Malformed push payload — use defaults
  }
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
