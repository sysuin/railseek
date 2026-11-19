// Timer for railseek alerts. Pages sites cannot run on a schedule, so this tiny Worker calls the
// site's /api/alerts/run every 15 minutes, repeating while alerts are still waiting to be checked.

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },
  async fetch() {
    return new Response("railseek alerts timer", { status: 404 });
  },
};

async function run(env) {
  for (let i = 0; i < 20; i++) {   // each call handles a few station pairs; stay well under 50 subrequests
    const res = await fetch(`${env.SITE}/api/alerts/run`, { method: "POST", headers: { "X-Run-Key": env.RUN_KEY, "Content-Type": "application/json" }, body: "{}" });
    const text = await res.text();
    if (!res.ok) { console.error("alerts run failed:", res.status, text.slice(0, 200)); return; }
    const r = JSON.parse(text);
    console.log("alerts run:", text);
    if (!r.remaining || r.stopped || r.checked === 0) return;
  }
}
