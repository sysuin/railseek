// Web Push without a payload (RFC 8030 + VAPID, RFC 8292). The push only wakes the browser's
// service worker, which then fetches its messages from /api/alerts/inbox. Sending no payload
// avoids message encryption entirely; the push endpoint itself is the private capability.

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = s => new TextEncoder().encode(s);

// Only real browser push services, so a crafted "subscription" cannot make us call other hosts.
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;
export function validEndpoint(url, env = {}) {
  if (typeof url !== "string" || url.length > 1000) return false;
  if (PUSH_HOSTS.test(url)) return true;
  return env.ALLOW_TEST_PUSH === "1" && /^http:\/\/127\.0\.0\.1:\d+\//.test(url);   // local tests only
}

let keyCache = null;
async function signingKey(env) {
  if (!keyCache) keyCache = crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_JWK), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return keyCache;
}

export async function vapidAuth(endpoint, env, now = Date.now()) {
  const head = b64u(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "https://railseek.divkrsh.com" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey(env), enc(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

// Returns "sent", "gone" (subscription no longer exists) or "failed".
export async function sendPush(endpoint, env, fetcher = (u, i) => fetch(u, i)) {
  try {
    const res = await fetcher(endpoint, { method: "POST", headers: { TTL: "43200", Urgency: "high", Authorization: await vapidAuth(endpoint, env), "Content-Length": "0" } });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) console.error("push refused:", res.status, (await res.text()).slice(0, 200));
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("push failed:", e && e.message);
    return "failed";
  }
}
