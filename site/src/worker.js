// Public railseek site: static page plus a small JSON API.
// Read-only: it searches and explains; it never logs in to IRCTC or books.

import { ALL_CLASSES, ProviderError, addDays, istToday, search, serialize } from "./core.js";
import { DemoProvider, LiveProvider, Quota } from "./providers.js";

const CODE = /^[A-Z]{1,6}$/, TRAIN = /^[0-9A-Z]{3,6}$/, QUOTAS = ["GN", "TQ", "LD", "SS"];
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

async function visitorAllowed(request, env, now) {
  // counts live searches per visitor per day; the address is hashed and expires in a day
  const limit = num(env, "VISITOR_DAILY_LIVE", 20);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = istToday(now);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}|railseek`));
  const key = "v:" + [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
  const used = +(await env.KV.get(key) || 0);
  if (used >= limit) return false;
  await env.KV.put(key, String(used + 1), { expirationTtl: 86400 });
  return true;
}

async function providerFor(request, env, body, now) {
  const quota = await new Quota(env.KV, num(env, "MONTHLY_CAP", 10), now).load();
  const wantLive = !body.demo && !!env.RAPIDAPI_KEY;
  if (!wantLive) return { provider: new DemoProvider(now), quota, demo: true };
  if (!(await visitorAllowed(request, env, now))) throw new BadRequest("You have reached today's limit for live searches. Demo data still works.");
  return { provider: new LiveProvider({ key: env.RAPIDAPI_KEY, kv: env.KV, quota, perSearch: num(env, "SEARCH_CAP", 8), now, base: env.UPSTREAM_BASE }), quota, demo: false };
}

const quotaInfo = (env, quota) => ({ live_available: !!env.RAPIDAPI_KEY && quota.remaining > 0, remaining: env.RAPIDAPI_KEY ? quota.remaining : 0, monthly_cap: quota.cap });

async function api(request, env, ctx, path) {
  const now = Date.now();
  if (path === "/api/meta" && request.method === "GET") {
    const quota = await new Quota(env.KV, num(env, "MONTHLY_CAP", 10), now).load();
    const today = istToday(now);
    return json(200, { today, max_date: addDays(today, 62), classes: ALL_CLASSES, ...quotaInfo(env, quota) });
  }
  if (request.method !== "POST" || !["/api/trains", "/api/check"].includes(path)) return json(404, { error: "Not found" });
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json(415, { error: "JSON only" });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: "Cross-site requests are not allowed" });
  let body;
  try { body = JSON.parse((await request.text()).slice(0, 4000)); } catch (e) { return json(400, { error: "Bad request" }); }
  if (!body || typeof body !== "object") return json(400, { error: "Bad request" });

  const j = journey(body, now);
  const { provider, quota, demo } = await providerFor(request, env, body, now);
  try {
    if (path === "/api/trains") {
      const trains = await provider.trainsBetween(j.origin, j.dest, j.on);
      return json(200, { ...j, date: j.on, demo, trains, quota: quotaInfo(env, quota) });
    }
    const train = String(body.train || "").trim().toUpperCase(), cls = String(body.cls || "").trim().toUpperCase();
    const q = String(body.quota || "GN").toUpperCase();
    if (!TRAIN.test(train) || !ALL_CLASSES.includes(cls) || !QUOTAS.includes(q)) throw new BadRequest("Pick a train and a class.");
    const req = { ...j, also_from: [], also_to: [], classes: [cls], quotas: [q], trains: [train], upstream: 3, downstream: 1 };
    const result = await search(provider, req);
    return json(200, { ...serialize(result, req, demo, now), quota: quotaInfo(env, quota) });
  } finally {
    ctx.waitUntil(quota.save());
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
