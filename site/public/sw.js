// Offline support: keeps the page itself available without a connection. Search data is
// never cached here; the page keeps your last search in local storage instead.
const VERSION = "railseek-v2";
const ASSETS = ["/", "/app.js", "/app.css", "/i18n.js", "/stations.json", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (e.request.mode === "navigate") {
    // the network first, so a fresh page always wins; the saved page when offline
    e.respondWith(fetch(e.request).catch(() => caches.match("/", { ignoreSearch: true })));
    return;
  }
  // files: the network first, so a new version is never mixed with an old one; the copy when offline
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
