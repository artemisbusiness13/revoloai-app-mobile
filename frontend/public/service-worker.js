/* RevoloAI Service Worker — basic offline app shell + asset cache.
   Strategy:
   - Pre-cache the app shell (HTML, manifest, icons, avatars) on install.
   - Network-first for /api/* (always try the live backend; fallback to a JSON error if offline).
   - Cache-first for static assets (JS, CSS, images, fonts) with background revalidation.
*/
const CACHE_VERSION = "revoloai-v2";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/avatars/maya.png",
  "/avatars/sofia.png",
  "/avatars/aria.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use individual requests so a single 404 doesn't fail the whole install
      Promise.allSettled(APP_SHELL.map((u) => cache.add(u)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|json)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Skip cross-origin (e.g. backend API on a different origin)
  if (url.origin !== self.location.origin) return;

  // API: network-first, no caching of responses (always live)
  if (isApi(url)) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Static assets: cache-first with background revalidation
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // HTML / navigation: network-first with offline fallback to root shell
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match("/");
      })
  );
});
