const CACHE_NAME = "easy-planner-cache-v2";
const ASSETS = ["/", "/manifest.webmanifest", "/favicon.ico"];
const OFFLINE_FALLBACK_URL = "/";

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.status === 200 &&
      (response.type === "basic" || response.type === "default"),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        if (isCacheableResponse(networkResponse)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        if (event.request.mode === "navigate") {
          const fallback = await caches.match(OFFLINE_FALLBACK_URL);
          if (fallback) {
            return fallback;
          }
        }
        throw new Error("Network request failed and no cache fallback is available.");
      }
    })(),
  );
});
