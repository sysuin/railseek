// Flexible dates, connecting journeys through hubs, and a data-source health check.

import { AccessDenied, BudgetExceeded, ProviderError, addDays, brief, istAt, istToday, score } from "./core.js";
import { COORDS } from "./coords.js";

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
  trainInfo(...a) { return this.primary.trainInfo ? this.run("trainInfo", a) : this.run("schedule", a).then(stops => ({ stops, coaches: [], days: [] })); }
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

export function pickHubs(routes, origin, dest, limit = 2) {
  // hubs on the direct trains' routes, in the first 60% of the way, nearest your station first.
  // Each route is a train's stops, measured up to where that train meets your destination city
  // (a search to NDLS often returns trains that end at ANVT or DLI).
  const seen = new Map();
  for (const r of routes) {
    const stops = Array.isArray(r) ? r : r && r.stops, alight = Array.isArray(r) ? dest : (r && r.alight) || dest;
    if (!stops) continue;
    const i = stops.findIndex(s => s.code === origin);
    const k = stops.findIndex((s, n) => n > i && (s.code === alight || s.code === dest));
    if (i < 0 || k < 0) continue;
    for (let n = i + 1; n < k; n++) {
      const code = stops[n].code, frac = (n - i) / (k - i);
      if (HUBS.has(code) && frac <= 0.6 && !seen.has(code)) seen.set(code, frac);
    }
  }
  if (seen.size) return [...seen.entries()].sort((a, b) => a[1] - b[1]).slice(0, limit).map(e => e[0]);
  // no usable route: junctions roughly on the way (at most 12% detour), about a third of the way first
  const total = distanceKm(origin, dest);
  if (!total) return [];
  const onWay = [];
  for (const code of HUBS) {
    if (code === origin || code === dest) continue;
    const a = distanceKm(origin, code), b = distanceKm(code, dest);
    if (a !== null && b !== null && a >= Math.max(60, total * 0.12) && a <= total * 0.6 && a + b <= total * 1.12) onWay.push([code, Math.abs(a - total * 0.3)]);
  }
  return onWay.sort((x, y) => x[1] - y[1]).slice(0, limit).map(e => e[0]);
}

function leg(t, b, on, fromCode, toCode) {
  const dep = istAt(on, hm(t.depart)), dur = durationMin(t);
  return { train: t.number, train_name: t.name.trim(), from: fromCode, to: toCode, date: on, depart: t.depart, arrive: t.arrive,
    dep_ms: dep, arr_ms: dur === null ? null : dep + dur * 60000, cls: b.cls, quota: b.quota, level: b.level, label: b.label, raw: b.raw, chance: b.chance, fare: b.fare, as_of: b.as_of, score: b.score };
}

export async function connections(provider, j, now, { maxHubs = 2, minGap = 60, maxGap = 8 * 60 } = {}) {
  const notes = [];
  const direct = await provider.trainsBetween(j.origin, j.dest, j.on);
  const directNos = new Set(direct.map(t => t.number));
  const routes = [];
  // routes of up to two direct trains, preferring regular trains (special trains run for a season)
  const regularFirst = [...direct].sort((a, b) => (a.number[0] === "0") - (b.number[0] === "0"));
  for (const t of regularFirst.slice(0, 4)) {
    if (routes.length === 2) break;
    try { routes.push({ stops: await provider.schedule(t.number), alight: t.alight }); } catch (e) { if (!(e instanceof ProviderError)) throw e; }
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

/* ---------- nearby starting stations ---------- */
export function distanceKm(a, b) {
  const p = COORDS[a], q = COORDS[b];
  if (!p || !q) return null;
  const rad = x => (x * Math.PI) / 180, dLat = rad(q[0] - p[0]), dLng = rad(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)));
}

export function nearbyStations(origin, dest, { maxKm = 150, limit = 3 } = {}) {
  // big junctions within reach of your station, nearest first (straight-line distance)
  const out = [];
  for (const code of HUBS) {
    if (code === origin || code === dest) continue;
    const km = distanceKm(origin, code);
    if (km !== null && km <= maxKm && km >= 5) out.push({ code, km });
  }
  const toDest = distanceKm(origin, dest);
  return out.filter(s => toDest === null || (distanceKm(s.code, dest) ?? 0) < toDest + 100)   // not a step backwards
    .sort((a, b) => a.km - b.km).slice(0, limit);
}

/* ---------- nearest airports, for a fallback when no train seat is open ---------- */
const AIRPORTS = [
  ["DEL", "Delhi", 28.556, 77.100], ["BOM", "Mumbai", 19.089, 72.865], ["BLR", "Bengaluru", 13.199, 77.706], ["MAA", "Chennai", 12.994, 80.171],
  ["CCU", "Kolkata", 22.654, 88.447], ["HYD", "Hyderabad", 17.240, 78.429], ["PNQ", "Pune", 18.582, 73.920], ["AMD", "Ahmedabad", 23.077, 72.635],
  ["GOI", "Goa", 15.381, 73.831], ["COK", "Kochi", 10.152, 76.402], ["TRV", "Thiruvananthapuram", 8.482, 76.920], ["JAI", "Jaipur", 26.824, 75.812],
  ["LKO", "Lucknow", 26.761, 80.889], ["VNS", "Varanasi", 25.452, 82.859], ["PAT", "Patna", 25.591, 85.088], ["GAY", "Gaya", 24.744, 84.951],
  ["IXR", "Ranchi", 23.314, 85.322], ["BBI", "Bhubaneswar", 20.244, 85.818], ["GAU", "Guwahati", 26.106, 91.586], ["IXB", "Bagdogra", 26.681, 88.329],
  ["NAG", "Nagpur", 21.092, 79.047], ["IDR", "Indore", 22.722, 75.801], ["BHO", "Bhopal", 23.287, 77.337], ["CCJ", "Kozhikode", 11.137, 75.955],
  ["CJB", "Coimbatore", 11.030, 77.043], ["IXM", "Madurai", 9.834, 78.093], ["VTZ", "Visakhapatnam", 17.721, 83.224], ["IXC", "Chandigarh", 30.673, 76.789],
  ["ATQ", "Amritsar", 31.710, 74.797], ["SXR", "Srinagar", 33.987, 74.774], ["DED", "Dehradun", 30.190, 78.180], ["GOP", "Gorakhpur", 26.740, 83.449],
  ["DBR", "Darbhanga", 26.193, 85.917], ["IXD", "Prayagraj", 25.440, 81.734], ["KNU", "Kanpur", 26.404, 80.410], ["AGR", "Agra", 27.156, 77.961],
  ["RPR", "Raipur", 21.180, 81.739], ["JDH", "Jodhpur", 26.251, 73.049], ["UDR", "Udaipur", 24.618, 73.896], ["STV", "Surat", 21.114, 72.742],
  ["IXE", "Mangaluru", 12.961, 74.890], ["VGA", "Vijayawada", 16.530, 80.797], ["TIR", "Tirupati", 13.632, 79.543], ["AYJ", "Ayodhya", 26.748, 82.155],
  ["DGH", "Deoghar", 24.444, 86.703], ["IXJ", "Jammu", 32.689, 74.837], ["GWL", "Gwalior", 26.293, 78.228], ["JLR", "Jabalpur", 23.178, 80.052],
];
export function nearestAirports(code, limit = 2, maxKm = 220) {
  const p = COORDS[code];
  if (!p) return [];
  const rad = x => (x * Math.PI) / 180;
  const out = [];
  for (const [iata, city, lat, lng] of AIRPORTS) {
    const dLat = rad(lat - p[0]), dLng = rad(lng - p[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p[0])) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
    const km = Math.round(12742 * Math.asin(Math.sqrt(h)));
    if (km <= maxKm) out.push({ code: iata, city, km });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, limit);
}

export async function nearbyStarts(provider, j, now) {
  const notes = [];
  const direct = new Set((await provider.trainsBetween(j.origin, j.dest, j.on)).map(t => t.number));
  const stations = nearbyStations(j.origin, j.dest);
  const found = [];
  for (const s of stations) {
    try {
      const trains = await provider.trainsBetween(s.code, j.dest, j.on);
      const st = provider.classStatuses ? await provider.classStatuses(s.code, j.dest, j.on) : {};
      for (const t of trains) {
        if (direct.has(t.number)) continue;   // also stops at your station: already in the main results
        const b = bestOf(st[t.number], t.classes, tatkalOpen(j.on, now));
        if (b) found.push({ station: s.code, km: s.km, train: t.number, train_name: t.name.trim(), board: t.board, alight: t.alight,
          depart: t.depart, arrive: t.arrive, duration: t.duration, ...b });
      }
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      notes.push(`Trains from ${s.code} could not be checked: ${e.message}`);
      if (e instanceof BudgetExceeded || e instanceof AccessDenied) break;
    }
  }
  // one entry per train: the station with the best odds, the nearer one on a tie
  found.sort((a, b) => b.score - a.score || a.km - b.km);
  const seen = new Set(), options = [];
  for (const o of found) { if (!seen.has(o.train)) { seen.add(o.train); options.push(o); } if (options.length === 5) break; }
  const from = nearestAirports(j.origin, 2), to = nearestAirports(j.dest, 1);
  const usable = from.length && to.length && !from.some(a => a.code === to[0].code);
  return { stations, options, notes, airports: usable ? { from, to: to[0] } : null };
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
