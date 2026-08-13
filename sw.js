const CACHE_NAME = "gps-site-photo-v3.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest?v=3.1",
  "./icon-180.png?v=3.1",
  "./icon-192.png?v=3.1",
  "./icon-512.png?v=3.1"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const fresh = await fetch(request, { cache: "no-store" });

    if (fresh && fresh.ok && fresh.type === "basic") {
      await cache.put(request, fresh.clone());
    }

    return fresh;
  }
  catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (request.mode === "navigate") {
      const fallback = await cache.match("./index.html", { ignoreSearch: true });
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Reverse geocoding stays network-only; GPS coordinates and photo stamping
  // continue to work offline.
  if (url.hostname === "nominatim.openstreetmap.org") return;

  // Same-origin app files are network-first so deployed updates are visible
  // immediately when online, with cached files as the offline fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});
