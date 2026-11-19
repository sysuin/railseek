// Key-value store on Cloudflare's Cache API. Same get/put interface as KV, but with no daily
// write limit (free KV allows 1,000 writes a day and 1 write per second to one key).
// Entries live in the data centre that wrote them, so counters kept here are per location and
// approximate. That is fine for caching and politeness limits; strict counts stay in KV.

const ORIGIN = "https://railseek-store.internal/";

export class CacheStore {
  constructor(cache) { this.cache = cache; }
  static open() {
    try { return new CacheStore(globalThis.caches && caches.default); } catch (e) { return new CacheStore(null); }
  }
  async get(key, type) {
    if (!this.cache) return null;
    try {
      const res = await this.cache.match(ORIGIN + encodeURIComponent(key));
      if (!res) return null;
      const text = await res.text();
      return type === "json" ? JSON.parse(text) : text;
    } catch (e) { return null; }
  }
  async put(key, value, opts = {}) {
    if (!this.cache) return;
    const ttl = Math.max(60, Math.min(opts.expirationTtl || 3600, 31 * 86400));
    try {
      await this.cache.put(ORIGIN + encodeURIComponent(key), new Response(String(value), { headers: { "Cache-Control": `public, max-age=${ttl}`, "Content-Type": "text/plain" } }));
    } catch (e) { /* a lost cache write only costs a repeat request */ }
  }
}
