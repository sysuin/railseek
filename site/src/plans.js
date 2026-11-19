// Flexible dates, connecting journeys through hubs, and a data-source health check.

import { AccessDenied, BudgetExceeded, ProviderError, addDays, brief, istAt, istToday, score } from "./core.js";

/* ---------- fall back to a second source when the first fails ---------- */
export class FallbackProvider {
  // primary: ConfirmTkt; makeSecondary: async () => RapidAPI provider, or null if not configured
  constructor(primary, makeSecondary) { this.primary = primary; this.makeSecondary = makeSecondary; this.secondary = null; this.down = false; this.name = primary.name; }
  get calls() { return this.primary.calls + (this.secondary ? this.secondary.calls : 0); }
  async run(method, args) {
    if (!this.down) {
      try { return await this.primary[method](...args); }
      catch (e) {
        if (e instanceof BudgetExceeded || !(e instanceof ProviderError)) throw e;
        console.error(`primary source failed in ${method}:`, e.message);
        this.down = true;
      }
    }
    if (!this.secondary) this.secondary = await this.makeSecondary();
    if (!this.secondary) throw new ProviderError("the data source did not answer and no backup source is set up");
    this.name = this.secondary.name;
    return this.secondary[method](...args);
  }
  trainsBetween(...a) { return this.run("trainsBetween", a); }
  schedule(...a) { return this.run("schedule", a); }
  availability(...a) { return this.run("availability", a); }
  async classStatuses(...a) {
    if (!this.down) { try { return await this.primary.classStatuses(...a); } catch (e) { if (!(e instanceof ProviderError) || e instanceof BudgetExceeded) throw e; this.down = true; } }
    return {};   // the backup source has no cheap per-class status; the page then shows plain chips
  }
}

/* ---------- helpers ---------- */
const hm = s => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };
function durationMin(t) {
  const d = hm(t.duration);
  if (d !== null) return d;
  const a = hm(t.depart), b = hm(t.arrive);
  return a === null || b === null ? null : (b - a + 1440) % 1440;
}
// Tatkal opens the day before travel, so a Tatkal figure for a later date is not bookable yet.
export const tatkalOpen = (on, now) => on <= addDays(istToday(now), 1);
function bestOf(statuses, classes, withTatkal) {
  // the best class/quota for one train, from its saved statuses
  let best = null;
  for (const q of withTatkal ? ["GN", "TQ"] : ["GN"]) for (const cls of classes) {
    const a = ((statuses || {})[q] || {})[cls];
    if (!a) continue;
    const s = score(a);
    if (s > 0 && (!best || s > best.score)) best = { score: s, cls, quota: q, ...brief(a) };
  }
  return best;
}

/* ---------- flexible dates ---------- */
export async function flexibleDates(provider, j, now) {
  const today = istToday(now), max = addDays(today, 62);
  const days = [-1, 0, 1, 2].map(n => addDays(j.on, n)).filter(d => d >= today && d <= max);
  const out = [];
  for (const day of days) {
    let trains = [], st = {}, error = "";
    try {
      trains = await provider.trainsBetween(j.origin, j.dest, day);
      st = provider.classStatuses ? await provider.classStatuses(j.origin, j.dest, day) : {};
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      error = e.message;
    }
    let best = null, open = 0;
    for (const t of trains) {
      const b = bestOf(st[t.number], t.classes, tatkalOpen(day, now));
      if (!b) continue;
      open++;
      if (!best || b.score > best.score) best = { ...b, train: t.number, train_name: t.name.trim(), depart: t.depart };
    }
    out.push({ date: day, selected: day === j.on, trains: trains.length, open, best, error });
    if (error && (error.includes("limit") || error.includes("refusing"))) break;
  }
  return out;
}

/* ---------- connecting journeys ---------- */
// Major junctions where many trains start or stop. A connection is only offered through these.
export const HUBS = new Set(("DDU PRYJ CNB LKO BSB BSBS PNBE GAYA ASN DHN HWH KOAA SDAH NDLS DLI ANVT NZM AGC GWL VGLJ BPL RKMP ET NGP " +
  "BZA MAS MS SBC SMVB YPR SC KCG PUNE BRC ADI ST JP KOTA RTM MTJ ALJN MB UMB LDH JAT GKP MFP BJU KIR NJP GHY TATA ROU " +
  "BBS KUR KGP VSKP RJY CSMT LTT MMCT BDTS DR KYN MAO MAJN ERS TVC CBE ED SA JTJ RU KPD GTL DMM UBL BGM MRJ BSL KTE JBP " +
  "R BSP DURG SBP JSG BKSC GMO HTE CPR SEE HJP DBG SPJ BGP JMP KIUL MKA BXR ARA DNR RJPB AY AYC FD BE BRY RMU FZR ASR " +
  "JUC BTI HSR REJ RE BKN JU AII UDZ BME").split(" "));

export function pickHubs(stopsList, origin, dest, limit = 2) {
  // hubs on the direct trains' routes, in the first 60% of the way, nearest your station first
  const seen = new Map();
  for (const stops of stopsList) {
    if (!stops) continue;
    const i = stops.findIndex(s => s.code === origin);
    const k = stops.findIndex((s, n) => n > i && s.code === dest);
    if (i < 0 || k < 0) continue;
    for (let n = i + 1; n < k; n++) {
      const code = stops[n].code, frac = (n - i) / (k - i);
      if (HUBS.has(code) && frac <= 0.6 && !seen.has(code)) seen.set(code, frac);
    }
  }
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, limit).map(e => e[0]);
}

function leg(t, b, on, fromCode, toCode) {
  const dep = istAt(on, hm(t.depart)), dur = durationMin(t);
  return { train: t.number, train_name: t.name.trim(), from: fromCode, to: toCode, date: on, depart: t.depart, arrive: t.arrive,
    dep_ms: dep, arr_ms: dur === null ? null : dep + dur * 60000, cls: b.cls, quota: b.quota, level: b.level, label: b.label, raw: b.raw, chance: b.chance, as_of: b.as_of, score: b.score };
}

export async function connections(provider, j, now, { maxHubs = 2, minGap = 60, maxGap = 8 * 60 } = {}) {
  const notes = [];
  const direct = await provider.trainsBetween(j.origin, j.dest, j.on);
  const directNos = new Set(direct.map(t => t.number));
  const routes = [];
  for (const t of direct.slice(0, 2)) {
    try { routes.push(await provider.schedule(t.number)); } catch (e) { if (!(e instanceof ProviderError)) throw e; }
  }
  const hubs = pickHubs(routes, j.origin, j.dest, maxHubs);
  const found = [];
  for (const hub of hubs) {
    try {
      const firstTrains = await provider.trainsBetween(j.origin, hub, j.on);
      const firstSt = provider.classStatuses ? await provider.classStatuses(j.origin, hub, j.on) : {};
      const firstLegs = firstTrains.map(t => { const b = bestOf(firstSt[t.number], t.classes, tatkalOpen(j.on, now)); return b && leg(t, b, j.on, j.origin, hub); })
        .filter(l => l && l.arr_ms !== null && l.dep_ms >= now);
      if (!firstLegs.length) continue;
      // second-leg dates: the days the first trains reach the hub, plus the next day for late arrivals
      const dates = new Set();
      for (const l of firstLegs) {
        const d = istToday(l.arr_ms); dates.add(d);
        if (l.arr_ms + maxGap * 60000 > istAt(addDays(d, 1), 0)) dates.add(addDays(d, 1));
      }
      for (const d2 of [...dates].sort().slice(0, 2)) {
        const second = await provider.trainsBetween(hub, j.dest, d2);
        const secondSt = provider.classStatuses ? await provider.classStatuses(hub, j.dest, d2) : {};
        for (const t2 of second) {
          if (directNos.has(t2.number)) continue;   // stops at your station too: that is a direct option, shown elsewhere
          const b2 = bestOf(secondSt[t2.number], t2.classes, tatkalOpen(d2, now));
          if (!b2) continue;
          const l2 = leg(t2, b2, d2, hub, j.dest);
          for (const l1 of firstLegs) {
            if (l1.train === l2.train) continue;
            const gap = Math.round((l2.dep_ms - l1.arr_ms) / 60000);
            if (!Number.isFinite(gap) || gap < minGap || gap > maxGap || l2.arr_ms === null) continue;
            found.push({ hub, gap, tight: gap < 120, total_min: Math.round((l2.arr_ms - l1.dep_ms) / 60000), arrive_ms: l2.arr_ms,
              score: Math.min(l1.score, l2.score), legs: [l1, l2] });
          }
        }
      }
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      notes.push(`Connections through ${hub} could not be checked: ${e.message}`);
      if (e instanceof BudgetExceeded || e instanceof AccessDenied) break;
    }
  }
  // best first; for equal odds, the earlier arrival; one entry per pair of trains
  found.sort((a, b) => b.score - a.score || a.arrive_ms - b.arrive_ms);
  const seen = new Set(), out = [];
  for (const c of found) {
    const key = c.legs.map(l => l.train).join(">");
    if (seen.has(key)) continue;
    seen.add(key); out.push(c);
    if (out.length === 5) break;
  }
  return { hubs, connections: out, notes };
}

/* ---------- health check ---------- */
export async function healthCheck(makeProvider, now) {
  // a busy daily route, fetched fresh: is the source answering in the shape we expect?
  const on = addDays(istToday(now), 1);
  const p = makeProvider();
  try {
    const trains = await p.trainsBetween("NDLS", "HWH", on);
    const st = await p.classStatuses("NDLS", "HWH", on);
    const parsed = Object.values(st).flatMap(q => Object.values(q.GN || {})).filter(a => a.kind !== "UNKNOWN").length;
    const ok = trains.length > 0 && parsed > 0;
    return { ok, trains: trains.length, parsed_statuses: parsed, problem: ok ? "" : trains.length ? "statuses could not be read" : "no trains returned" };
  } catch (e) {
    return { ok: false, trains: 0, parsed_statuses: 0, problem: e.message };
  }
}
