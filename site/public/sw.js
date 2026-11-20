// Offline support: keeps the page itself available without a connection. Search data is
// never cached here; the page keeps your last search in local storage instead.
const VERSION = "railseek-v4";
const ASSETS = ["/", "/app.js", "/app.css", "/i18n.js", "/stations.json", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Alerts: a push carries no data; it tells the worker to fetch its messages and show them.
self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let messages = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const res = await fetch("/api/alerts/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        if (res.ok) messages = (await res.json()).messages || [];
      }
    } catch (err) { /* show the fallback below */ }
    if (!messages.length) messages = [{ id: "x", title: "railseek", body: "An alert changed. Open railseek to see it.", url: "/" }];
    await Promise.all(messages.map(m => self.registration.showNotification(m.title, {
      body: m.body, icon: "/icon-192.png", badge: "/icon-192.png", tag: `railseek-${m.id}`, data: { url: m.url || "/" },
    })));
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (w.url.startsWith(self.location.origin) && "navigate" in w) { await w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  })());
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
