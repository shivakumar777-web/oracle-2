/* MANTHANA lightweight PWA — cache static chunks; offline fallback for navigations. */
const STATIC_CACHE = "manthana-pwa-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (cached) =>
            cached ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Let cross-origin requests bypass the SW so we don't wrap them in fetch() (avoids tight connect-src on CDNs).
  const scopeOrigin = new URL(self.registration.scope).origin;
  if (url.origin !== scopeOrigin) {
    return;
  }

  event.respondWith(fetch(req));
});
