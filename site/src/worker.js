// Public railseek site: static page plus a small JSON API.
// Read-only: it searches and explains; it never logs in to IRCTC or books.

import { ALL_CLASSES, ProviderError, addDays, brief, istToday, search, serialize } from "./core.js";
import { ConfirmTktProvider, DemoProvider, LiveProvider, Quota } from "./providers.js";
import { FallbackProvider, connections, flexibleDates, healthCheck, nearbyStarts, tatkalOpen } from "./plans.js";
import { CacheStore } from "./store.js";
import { readHistory, recorder } from "./history.js";
import { AlertError, createAlert, deleteAlert, listAlerts, runAlerts, takeInbox, testAlert } from "./alerts.js";

const CODE = /^[A-Z]{1,6}$/, TRAIN = /^[0-9A-Z]{3,6}$/, QUOTAS = ["GN", "TQ"];
const TOP_BATCH = 3;
class BadRequest extends Error {}

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const num = (env, name, dflt) => { const n = parseInt(env[name], 10); return Number.isFinite(n) ? n : dflt; };

function journey(body, now) {
  const origin = String(body.origin || "").trim().toUpperCase(), dest = String(body.dest || "").trim().toUpperCase();
  if (!CODE.test(origin) || !CODE.test(dest)) throw new BadRequest("Enter station codes for From and To, for example SSM and NDLS.");
  if (origin === dest) throw new BadRequest("From and To are the same station.");
  const on = String(body.date || "");
  const today = istToday(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || isNaN(Date.parse(on))) throw new BadRequest("Pick a journey date.");
  if (on < today || on > addDays(today, 62)) throw new BadRequest("The journey date must be between today and about 60 days from now.");
  return { origin, dest, on };
}

async function visitorAllowed(request, env, now, prefix = "v", limit = num(env, "VISITOR_DAILY_LIVE", 300)) {
  // counts calls per visitor per day; the address is hashed and expires in a day
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = istToday(now);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|railseek`));
  const key = prefix + ":" + [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
  const store = CacheStore.open();   // not KV: free KV allows only 1,000 writes a day
  const used = +(await store.get(key) || 0);
  if (used >= limit) return false;
  await store.put(key, String(used + 1), { expirationTtl: 86400 });
  return true;
}

// DATA_SOURCE "confirmtkt" (default, no key) or "irctc1" (RapidAPI key with a monthly allowance)
const source = env => (env.DATA_SOURCE === "irctc1" && env.RAPIDAPI_KEY ? "irctc1" : "confirmtkt");
// The RapidAPI allowance is small and strict, so it is counted in KV (a few writes a month).
// ConfirmTkt's politeness cap is counted in the Cache API store, per data centre.
const rapidQuota = (env, now) => new Quota(env.KV, num(env, "MONTHLY_CAP", 10), now).load();
const loadQuota = (env, now) => (source(env) === "irctc1"
  ? rapidQuota(env, now)
  : new Quota(CacheStore.open(), num(env, "DAILY_CAP", 3000), now, "day", "ct:").load());

async function providerFor(request, env, body, now) {
  const quota = await loadQuota(env, now);
  if (body.demo) return { provider: new DemoProvider(now), quota, demo: true };
  if (!(await visitorAllowed(request, env, now))) throw new BadRequest("You have reached today's limit for live searches. Demo data still works.");
  return liveProvider(env, now, body.__perSearch || num(env, "SEARCH_CAP", 8), quota, body.__ctx);
}

async function liveProvider(env, now, perSearch, quota, ctx) {
  quota = quota || await loadQuota(env, now);
  const opts = { quota, perSearch, now, base: env.UPSTREAM_BASE };
  if (source(env) === "irctc1") return { provider: new LiveProvider({ ...opts, kv: env.KV, key: env.RAPIDAPI_KEY }), quota, demo: false };
  const primary = new ConfirmTktProvider({ ...opts, kv: CacheStore.open(), onFresh: ctx ? recorder(env.DB, ctx) : null });
  const backup = env.RAPIDAPI_KEY ? async () => {
    const q = await rapidQuota(env, now);
    backupQuota = q;
    return q.remaining > 0 ? new LiveProvider({ ...opts, quota: q, kv: env.KV, key: env.RAPIDAPI_KEY }) : null;
  } : async () => null;
  let backupQuota = null;
  const provider = new FallbackProvider(primary, backup);
  provider.saveBackup = () => (backupQuota ? backupQuota.save() : null);
  return { provider, quota, demo: false };
}

const quotaInfo = (env, quota) => ({ source: source(env), live_available: quota.remaining > 0, remaining: quota.remaining, cap: quota.cap, period: quota.period });

async function api(request, env, ctx, path) {
  const now = Date.now();
  if (path === "/api/meta" && request.method === "GET") {
    const quota = await loadQuota(env, now);
    const today = istToday(now);
    return json(200, { today, max_date: addDays(today, 62), classes: ALL_CLASSES, ...quotaInfo(env, quota),
      push_key: env.DB && env.VAPID_PRIVATE_JWK ? env.VAPID_PUBLIC || "" : "" });
  }
  if (path === "/api/health" && request.method === "GET") {
    // checked at most every 10 minutes, so calling this often cannot load the data source
    const store = CacheStore.open();
    let result = await store.get("health", "json");
    if (!result) {
      const q = new Quota({ get: async () => null, put: async () => {} }, 10, now, "day", "health:");
      result = { ...(await healthCheck(() => new ConfirmTktProvider({ kv: { get: async () => null, put: async () => {} }, quota: q, perSearch: 4, now, base: env.UPSTREAM_BASE }), now)), checked_at: new Date(now).toISOString() };
      await store.put("health", JSON.stringify(result), { expirationTtl: 600 });
    }
    return json(result.ok ? 200 : 503, result);
  }
  if (path.startsWith("/api/alerts/") && request.method === "POST") return alertsApi(request, env, ctx, path, now);
  if (path === "/api/history" && request.method === "POST") {
    // saved figures over time for one option; a database read, no call to the data source
    const b = await readJson(request);
    const up = v => String((b || {})[v] || "").toUpperCase();
    if (!b || !TRAIN.test(up("train")) || !CODE.test(up("book_from")) || !CODE.test(up("book_to")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.book_date || "")) || !/^[0-9A-Z]{2}$/.test(up("cls")))
      return json(400, { error: "Bad request" });
    if (!env.DB) return json(200, { points: [] });
    return json(200, { points: await readHistory(env.DB, { train: up("train"), book_from: up("book_from"), book_to: up("book_to"), book_date: b.book_date, cls: up("cls") }) });
  }
  if (request.method !== "POST" || !["/api/trains", "/api/check", "/api/top", "/api/dates", "/api/connections", "/api/nearby", "/api/route"].includes(path)) return json(404, { error: "Not found" });
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json(415, { error: "JSON only" });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: "Cross-site requests are not allowed" });
  let body;
  try { body = JSON.parse((await request.text()).slice(0, 4000)); } catch (e) { return json(400, { error: "Bad request" }); }
  if (!body || typeof body !== "object") return json(400, { error: "Bad request" });

  if (path === "/api/route") {
    const train = String(body.train || "").trim().toUpperCase();
    if (!TRAIN.test(train)) return json(400, { error: "Bad train number." });
    body.__perSearch = 2; body.__ctx = ctx;
    const { provider, quota, demo } = await providerFor(request, env, body, now);
    try {
      if (!provider.trainInfo) return json(404, { error: "Route details are not available." });
      return json(200, { demo, ...(await provider.trainInfo(train)) });
    } finally { ctx.waitUntil(quota.save()); }
  }
  const j = journey(body, now);
  body.__ctx = ctx;
  body.__perSearch = path === "/api/connections" || path === "/api/check" ? 10 : path === "/api/dates" || path === "/api/nearby" ? 6 : null;
  const { provider, quota, demo } = await providerFor(request, env, body, now);
  try {
    if (path === "/api/trains") {
      const hits = await provider.trainsBetween(j.origin, j.dest, j.on);
      const st = provider.classStatuses ? await provider.classStatuses(j.origin, j.dest, j.on) : {};
      const pack = m => Object.fromEntries(Object.entries(m || {}).map(([cls, a]) => [cls, brief(a)]).filter(([, b]) => b));
      const trains = hits.map(t => ({ ...t, status: { GN: pack((st[t.number] || {}).GN), TQ: pack((st[t.number] || {}).TQ) } }));
      return json(200, { ...j, date: j.on, demo, trains, quota: quotaInfo(env, quota) });
    }
    if (path === "/api/dates") {
      return json(200, { ...j, date: j.on, demo, days: await flexibleDates(provider, j, now), quota: quotaInfo(env, quota) });
    }
    if (path === "/api/nearby") {
      return json(200, { ...j, date: j.on, demo, ...(await nearbyStarts(provider, j, now)), quota: quotaInfo(env, quota) });
    }
    if (path === "/api/connections") {
      const r = await connections(provider, j, now);
      return json(200, { ...j, date: j.on, demo, ...r, quota: quotaInfo(env, quota) });
    }
    if (path === "/api/top") {
      // Best options for a few trains at a time: every class, general and Tatkal, direct and
      // booked from the train's first station. Small batches keep each call within platform limits.
      const trains = (Array.isArray(body.trains) ? body.trains : []).map(t => String(t).trim().toUpperCase());
      if (!trains.length || trains.length > TOP_BATCH || !trains.every(t => TRAIN.test(t))) throw new BadRequest("Bad train list.");
      const req = { ...j, also_from: [], also_to: [], classes: [], quotas: tatkalOpen(j.on, now) ? ["GN", "TQ"] : ["GN"], trains, upstream: 1, downstream: 0 };
      const result = await search(provider, req);
      const open = result.options.filter(o => o.score > 0);
      result.options = open.slice(0, 8);
      return json(200, { ...serialize(result, req, demo, now), open_count: open.length, quota: quotaInfo(env, quota) });
    }
    const train = String(body.train || "").trim().toUpperCase(), cls = String(body.cls || "").trim().toUpperCase();
    const q = String(body.quota || "GN").toUpperCase();
    if (!TRAIN.test(train) || !ALL_CLASSES.includes(cls) || !QUOTAS.includes(q)) throw new BadRequest("Pick a train and a class.");
    const req = { ...j, also_from: [], also_to: [], classes: [cls], quotas: [q], trains: [train], upstream: 3, downstream: 1, splits: 1 };
    const result = await search(provider, req);
    return json(200, { ...serialize(result, req, demo, now), quota: quotaInfo(env, quota) });
  } finally {
    ctx.waitUntil(quota.save());
    if (provider.saveBackup) ctx.waitUntil(Promise.resolve(provider.saveBackup()));
  }
}

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return null;
  try { const b = JSON.parse((await request.text()).slice(0, 6000)); return b && typeof b === "object" ? b : null; } catch (e) { return null; }
}

async function alertsApi(request, env, ctx, path, now) {
  if (!env.DB || !env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return json(503, { error: "Alerts are not set up on this site." });
  const name = path.slice("/api/alerts/".length);
  if (name === "run") {
    // called by the timer Worker only
    const key = request.headers.get("X-Run-Key") || "";
    if (!env.RUN_KEY || key.length !== env.RUN_KEY.length || key !== env.RUN_KEY) return json(403, { error: "Forbidden" });
    const { provider, quota } = await liveProvider(env, now, 12, null, ctx);
    try { return json(200, await runAlerts(env, now, provider)); } finally { ctx.waitUntil(quota.save()); }
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: "Cross-site requests are not allowed" });
  const body = await readJson(request);
  if (!body) return json(400, { error: "Bad request" });
  try {
    if (name === "create") {
      const { provider, quota } = await liveProvider(env, now, 3, null, ctx);
      try { return json(200, { alert: await createAlert(env, body, now, provider, () => visitorAllowed(request, env, now, "alert", 20)) }); }
      finally { ctx.waitUntil(quota.save()); }
    }
    if (name === "list") return json(200, { alerts: await listAlerts(env, body, now) });
    if (name === "delete") return json(200, await deleteAlert(env, body));
    if (name === "inbox") return json(200, { messages: await takeInbox(env, body) });
    if (name === "test") return json(200, await testAlert(env, body, now, () => visitorAllowed(request, env, now, "ptest", 5)));
    return json(404, { error: "Not found" });
  } catch (e) {
    if (e instanceof AlertError) return json(400, { error: e.message });
    throw e;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, ctx, url.pathname);
    } catch (e) {
      if (e instanceof BadRequest) return json(400, { error: e.message });
      if (e instanceof ProviderError) return json(502, { error: `Live data is not available right now: ${e.message}. Demo data still works.`, live_failed: true });
      console.error(e);
      return json(500, { error: "Something went wrong on our side." });
    }
  },
};
