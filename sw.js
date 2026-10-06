const CACHE_NAME = "ohc-quote-v3-i18n";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./i18n.js",
  "./app.js",
  "./qr-code.js",
  "./manifest.webmanifest",
  "./icons/ohc-192.png",
  "./icons/ohc-512.png",
  "./icons/logo-mark.svg",
  "./sw.js"
];

function freshRequest(path) {
  return new Request(path, { cache: "reload", credentials: "same-origin" });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(APP_SHELL.map((path) =>
      fetch(freshRequest(path)).then((response) => {
        if (!response.ok) throw new Error("Could not cache " + path);
        return cache.put(path, response);
      })
    )))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function networkRequest(request) {
  if (request.mode === "navigate") {
    return new Request(request.url, { cache: "reload", credentials: "same-origin", redirect: "follow" });
  }
  return new Request(request, { cache: "reload" });
}

function fromCache(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    if (request.mode === "navigate") {
      return caches.match("./index.html").then((index) => index || caches.match("./"));
    }
    return undefined;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache admin or API
  if (url.pathname.includes("/api/") || url.pathname.endsWith("/admin.html") || url.pathname.endsWith("/admin.js")) {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(
    fetch(networkRequest(request)).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request.url, copy));
      }
      return response;
    }).catch(() => fromCache(request).then((cached) => cached || caches.match("./")))
  );
});
