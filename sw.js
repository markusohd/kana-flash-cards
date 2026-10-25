// Service worker: keeps a copy of the app on the device so it works offline.
//
// How it works:
// 1. On install, it downloads every app file below into a cache.
// 2. On every request, it answers from the cache straight away (fast, works offline)
//    and, if online, fetches a fresh copy in the background for next time.
//    So after an update is published, the new version shows on the next app open.
//
// When you change the list of files, bump CACHE_VERSION so old caches are cleared.

const CACHE_VERSION = "v1";
const APP_CACHE = `kana-app-${CACHE_VERSION}`;
const FONT_CACHE = "kana-fonts"; // Google Fonts files, kept across versions

const APP_FILES = [
  "./",
  "index.html",
  "manifest.json",
  "css/styles.css",
  "js/app.js",
  "js/card.js",
  "js/deck.js",
  "js/storage.js",
  "data/kana.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

// ---------- Install: save every app file ----------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()) // use this version right away
  );
});

// ---------- Activate: delete caches from older versions ----------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("kana-app-") && name !== APP_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim()) // take control of open pages
  );
});

// ---------- Fetch: answer from the cache, refresh in the background ----------

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const isOurs = url.origin === self.location.origin;
  if (!isFont && !isOurs) return; // let the browser handle anything else

  const cacheName = isFont ? FONT_CACHE : APP_CACHE;
  event.respondWith(cachedThenRefresh(event, request, cacheName));
});

async function cachedThenRefresh(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreSearch: "index.html?x" still finds "index.html"
  const cached = await cache.match(request, { ignoreSearch: true });

  const fresh = fetch(request)
    .then((response) => {
      // Save good responses ("opaque" = cross-origin font CSS, which is fine to keep)
      if (response.ok || response.type === "opaque") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null); // offline

  if (cached) {
    event.waitUntil(fresh); // let the background refresh finish
    return cached;
  }
  const response = await fresh;
  if (response) return response;

  // Offline and not cached: for a page visit, fall back to the app itself.
  if (request.mode === "navigate") {
    return (await cache.match("index.html")) ?? Response.error();
  }
  return Response.error();
}
