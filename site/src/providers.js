// Data providers: invented demo data, and the unofficial "IRCTC" API on RapidAPI
// behind a shared key with a monthly allowance and a KV cache.

import { AccessDenied, BudgetExceeded, ProviderError, isoStamp, parseStatus } from "./core.js";

/* ---------- demo (same invented data as railseek/providers/demo.py) ---------- */
const ROUTES = {
  "90001": ["Demo Coastal Express", ["SL", "3A", "2A", "1A"], [
    ["PURI", "Puri", 1, "21:45"], ["BBS", "Bhubaneswar", 1, "23:00"], ["TATA", "Tatanagar", 2, "06:30"], ["GAYA", "Gaya Jn", 2, "13:10"],
    ["SSM", "Sasaram", 2, "14:58"], ["DDU", "Pt DD Upadhyaya Jn", 2, "16:50"], ["PRYJ", "Prayagraj Jn", 2, "19:05"], ["CNB", "Kanpur Central", 2, "21:20"], ["NDLS", "New Delhi", 3, "04:50"]]],
  "90002": ["Demo Bodhi Express", ["SL", "3E", "3A", "2A", "1A"], [
    ["GAYA", "Gaya Jn", 1, "14:00"], ["SSM", "Sasaram", 1, "15:28"], ["DDU", "Pt DD Upadhyaya Jn", 1, "17:15"], ["PRYJ", "Prayagraj Jn", 1, "19:30"], ["CNB", "Kanpur Central", 1, "21:50"], ["NDLS", "New Delhi", 2, "04:10"]]],
  "90003": ["Demo Eastern Mail", ["SL", "3A", "2A"], [
    ["HWH", "Howrah Jn", 1, "21:55"], ["DHN", "Dhanbad Jn", 2, "02:10"], ["GAYA", "Gaya Jn", 2, "05:05"], ["SSM", "Sasaram", 2, "06:29"], ["DDU", "Pt DD Upadhyaya Jn", 2, "08:20"],
    ["CNB", "Kanpur Central", 2, "13:40"], ["DLI", "Delhi Jn", 2, "20:30"], ["KLK", "Kalka", 3, "03:00"]]],
  "90004": ["Demo Junction Express", ["SL", "3A", "2A"], [
    ["DDU", "Pt DD Upadhyaya Jn", 1, "19:30"], ["PRYJ", "Prayagraj Jn", 1, "21:40"], ["CNB", "Kanpur Central", 2, "00:10"], ["NDLS", "New Delhi", 2, "06:00"]]],
};
const MULT = { SL: 1, "3E": 2.4, "3A": 2.6, "2A": 3.7, "1A": 6.2 };

function demoStatus(train, f, t, n, cls) {
  const fromOrigin = f === 0;
  if (cls === "1A") return [fromOrigin ? "GNWL4/WL3" : "PQWL5/WL4", 45];
  if (train === "90001") return fromOrigin ? [cls === "2A" ? "AVAILABLE-0006" : "GNWL18/WL9", 78] : ["REGRET", null];
  if (train === "90002") return fromOrigin ? [cls === "3A" || cls === "3E" ? "AVAILABLE-0014" : "RAC 12", 90] : [cls === "SL" ? "PQWL44/WL31" : "REGRET", 12];
  if (train === "90004") return [cls === "2A" ? "RAC 3" : "AVAILABLE-0020", 90];
  if (f <= 1) return ["GNWL22/WL11", 70];
  if (t === n - 1 && f >= 3) return ["RLWL9/WL6", 40];
  return [cls === "SL" ? "RLWL30/WL24" : "REGRET", 8];
}

export class DemoProvider {
  name = "demo";
  constructor(now) { this.now = now; }
  async trainsBetween(frm, to) {
    const hits = [];
    for (const [number, [name, classes, route]] of Object.entries(ROUTES)) {
      const codes = route.map(s => s[0]), i = codes.indexOf(frm), j = codes.indexOf(to);
      if (i >= 0 && j > i) hits.push({ number, name, board: frm, alight: to, classes: [...classes], depart: route[i][3], arrive: route[j][3], duration: "" });
    }
    return hits;
  }
  async classStatuses(frm, to, on) {
    const out = {};
    for (const t of await this.trainsBetween(frm, to)) {
      out[t.number] = { GN: {}, TQ: {} };
      for (const q of ["GN", "TQ"]) for (const c of t.classes) out[t.number][q][c] = await this.availability(t.number, frm, to, on, c, q);
    }
    return out;
  }
  async schedule(trainNo) {
    if (!ROUTES[trainNo]) throw new ProviderError(`unknown demo train ${trainNo}`);
    return ROUTES[trainNo][2].map(([code, name, day, t], seq) => ({ code, name, seq, day, dep_min: +t.slice(0, 2) * 60 + +t.slice(3) }));
  }
  async availability(trainNo, frm, to, on, cls, quota) {
    if (!ROUTES[trainNo]) throw new ProviderError(`unknown demo train ${trainNo}`);
    const codes = ROUTES[trainNo][2].map(s => s[0]), f = codes.indexOf(frm), t = codes.indexOf(to);
    if (f < 0 || t < 0) throw new ProviderError("station not on this demo route");
    let [raw, prob] = demoStatus(trainNo, f, t, codes.length, cls);
    if (quota === "TQ") [raw, prob] = ["TQWL6/WL6", 20];
    const a = parseStatus(raw);
    a.probability = a.kind === "WL" ? prob : null;
    a.fare = 400 + 1.1 * 100 * (t - f) * (MULT[cls] || 1);
    a.fetched_at = isoStamp(this.now);
    return a;
  }
}

/* ---------- live ---------- */
const BASE = "https://irctc1.p.rapidapi.com";
const TTL = { trains: 24 * 3600, schedule: 7 * 24 * 3600, avail: 10 * 60 };
const first = (o, ...names) => { for (const n of names) if (o[n] !== undefined && o[n] !== null && o[n] !== "") return o[n]; return undefined; };
const hhmm = v => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v || "")); return m ? +m[1] * 60 + +m[2] : null; };
const toIso = v => {
  const s = String(v || "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m) return s;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};

export class Quota {
  // Allowance of upstream requests per period ("month" for the RapidAPI key, "day" for
  // ConfirmTkt). KV counters are not atomic, which is fine: this is a politeness cap.
  constructor(kv, cap, now, period = "month", tag = "") {
    this.kv = kv; this.cap = cap; this.used = 0; this.blocked = false; this.spent = 0;
    this.month = tag + new Date(now).toISOString().slice(0, period === "day" ? 10 : 7);
    this.blockKey = `q:blocked${tag}`; this.period = period;
  }
  async load() {
    const [used, blocked] = await Promise.all([this.kv.get(`q:${this.month}`), this.kv.get(this.blockKey)]);
    this.used = +(used || 0); this.blocked = !!blocked;
    return this;
  }
  get remaining() { return this.blocked ? 0 : Math.max(0, this.cap - this.used); }
  take() {
    if (this.remaining <= 0) throw new BudgetExceeded(this.period === "day" ? "today's live data allowance is used up" : "this month's live data allowance is used up");
    this.used++; this.spent++;
  }
  refund() { this.used = Math.max(0, this.used - 1); this.spent--; }
  async block(seconds) { this.blocked = true; await this.kv.put(this.blockKey, "1", { expirationTtl: Math.max(60, Math.min(seconds || 3600, 31 * 86400)) }); }
  async save() { if (this.spent > 0) await this.kv.put(`q:${this.month}`, String(this.used), { expirationTtl: 40 * 86400 }); }
}

export class LiveProvider {
  name = "irctc1";
  constructor({ key, kv, quota, perSearch, now, fetcher, base }) {
    this.base = base || BASE;
    this.headers = { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "irctc1.p.rapidapi.com", Accept: "application/json" };
    this.kv = kv; this.quota = quota; this.perSearch = perSearch; this.calls = 0; this.now = now; this.fetcher = fetcher || ((url, init) => fetch(url, init));  // never call the global fetch as a method: Workers throws "Illegal invocation"
  }
  async cached(key, ttl, load) {
    const hit = await this.kv.get(key, "json");
    if (hit) return hit;
    const value = await load();
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
    return value;
  }
  async get(path, params) {
    if (this.calls >= this.perSearch) throw new BudgetExceeded(`this search reached its limit of ${this.perSearch} live requests`);
    this.quota.take();
    this.calls++;
    let res;
    try { res = await this.fetcher(`${this.base}${path}?${new URLSearchParams(params)}`, { headers: this.headers, signal: AbortSignal.timeout(20000) }); }
    catch (e) {
      console.error("upstream fetch failed:", e && e.name, e && e.message);
      this.quota.refund(); this.calls--;   // nothing reached the data source, so it does not count
      throw new ProviderError("the data source did not answer");
    }
    if ([401, 403, 429].includes(res.status)) {
      await this.quota.block(+res.headers.get("x-ratelimit-basic-reset") || 3600);
      throw new AccessDenied("the data source refused the request (allowance used up or key problem)");
    }
    if (!res.ok) throw new ProviderError(`the data source returned an error (${res.status})`);
    try { return await res.json(); } catch (e) { throw new ProviderError("the data source sent an unreadable answer"); }
  }
  trainsBetween(frm, to, on) {
    return this.cached(`c:t:${frm}:${to}:${on}`, TTL.trains, async () => {
      const data = await this.get("/api/v3/trainBetweenStations", { fromStationCode: frm, toStationCode: to, dateOfJourney: on });
      const rows = Array.isArray(data && data.data) ? data.data : [];
      return rows.map(r => ({
        number: String(first(r, "train_number", "trainNumber", "train_no") || "").trim(),
        name: String(first(r, "train_name", "trainName") || ""),
        board: String(first(r, "from", "from_station_code") || frm).toUpperCase(),
        alight: String(first(r, "to", "to_station_code") || to).toUpperCase(),
        classes: (first(r, "class_type", "classes") || []).map(c => String(c).toUpperCase()),
        depart: String(first(r, "from_std", "departure") || ""), arrive: String(first(r, "to_sta", "arrival") || ""), duration: String(first(r, "duration") || ""),
      })).filter(h => /^[0-9A-Z]{3,6}$/.test(h.number));
    });
  }
  schedule(trainNo) {
    return this.cached(`c:s:${trainNo}`, TTL.schedule, async () => {
      const data = await this.get("/api/v1/getTrainSchedule", { trainNo });
      const route = data && data.data && data.data.route;
      if (!Array.isArray(route)) throw new ProviderError(`no route in schedule response for ${trainNo}`);
      const stops = [];
      for (const r of route) {
        if (r.stop === false) continue;
        const code = String(first(r, "station_code", "stationCode") || "").toUpperCase();
        if (!code) continue;
        let dep = first(r, "std_min");
        if (dep === undefined) dep = hhmm(first(r, "departure", "arrival"));
        stops.push({ code, name: String(first(r, "station_name", "stationName") || code), seq: stops.length, day: +(first(r, "day") || 1), dep_min: dep === null || dep === undefined ? null : ((+dep % 1440) + 1440) % 1440 });
      }
      if (stops.length < 2) throw new ProviderError(`schedule for ${trainNo} has fewer than two stops`);
      if (Math.min(...stops.map(s => s.day)) === 0) stops.forEach(s => s.day++);
      return stops;
    });
  }
  availability(trainNo, frm, to, on, cls, quota) {
    return this.cached(`c:a:${trainNo}:${frm}:${to}:${on}:${cls}:${quota}`, TTL.avail, async () => {
      const data = await this.get("/api/v2/checkSeatAvailability", { classType: cls, fromStationCode: frm, quota, toStationCode: to, trainNo, date: on });
      let rows = data && data.data, fare = null;
      if (rows && Array.isArray(rows.availabilityClassList)) {
        const block = rows.availabilityClassList.find(b => String(b.reservationClass || "").toUpperCase() === cls) || rows.availabilityClassList[0] || {};
        fare = (block.charges || {}).totalFare ?? null;
        rows = block.availabilities || [];
      } else if (rows && !Array.isArray(rows)) rows = [rows];
      let a;
      if (!Array.isArray(rows) || !rows.length) { a = parseStatus(String((data && data.message) || "")); a.raw = String((data && data.message) || "no data returned"); }
      else {
        let row = rows.find(r => toIso(r.date) === on);
        const dated = rows.some(r => toIso(r.date));
        if (!row) row = dated ? null : rows[0];   // never show another day's status as the requested day's
        a = parseStatus(row ? String(first(row, "status", "current_status", "availability") || "") : "");
        if (!row) a.raw = "requested date not in response";
        else {
          if (typeof row.prediction === "number") a.probability = Math.round(row.prediction * 1000) / 10;
          const f = first(row, "total_fare", "ticket_fare", "fare");
          if (f !== undefined) fare = f;
        }
      }
      a.fare = fare === null || fare === undefined || isNaN(+fare) ? null : +fare;
      a.fetched_at = isoStamp(this.now);
      return a;
    });
  }
}

/* ---------- ConfirmTkt public search: no key; one request per station pair covers every train and class ---------- */
const CT = "https://cttrainsapi.confirmtkt.com/api/v1/trains";
const CT_FIELD = { GN: "gn", TQ: "tq" };
const na = raw => ({ ...parseStatus(""), raw, kind: "NA" });
const ddmmyyyy = iso => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const titleCase = s => String(s || "").toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

function trimEntries(map) {
  const out = {};
  for (const [cls, e] of Object.entries(map || {})) {
    if (!e || typeof e !== "object") continue;
    out[cls] = { a: String(e.availability || ""), p: typeof e.predictionPercentage === "number" ? e.predictionPercentage : null, f: +e.fare || 0, d: String(e.date || "").slice(0, 10), t: String(e.cacheTime || "").slice(0, 19) };
  }
  return out;
}

export function ctEntry(e, on) {
  // ConfirmTkt's saved copy for one class; fetched_at is when ConfirmTkt saved it (IST)
  let a;
  if (e.d !== on) a = { ...parseStatus(""), raw: "requested date not in response" };
  else {
    a = parseStatus(e.a);
    if (a.kind === "WL" && e.p !== null && e.p > 0) a.probability = e.p;
    a.fare = e.f > 0 ? e.f : null;
  }
  a.fetched_at = e.t.length === 19 ? e.t + "+05:30" : "";
  return a;
}

export class ConfirmTktProvider {
  name = "confirmtkt";
  constructor({ kv, quota, perSearch, fetcher, base, onFresh }) {
    this.onFresh = onFresh;   // called with each freshly fetched pair, to keep its history
    this.kv = kv; this.quota = quota; this.perSearch = perSearch; this.calls = 0; this.base = base || CT;
    this.fetcher = fetcher || ((url, init) => fetch(url, init));
    this.pairs = new Map();
  }
  async get(path, params) {
    if (this.calls >= this.perSearch) throw new BudgetExceeded(`this search reached its limit of ${this.perSearch} live requests`);
    this.quota.take(); this.calls++;
    let res;
    try { res = await this.fetcher(`${this.base}${path}?${new URLSearchParams(params)}`, { headers: { Accept: "application/json", "User-Agent": "railseek/0.2" }, signal: AbortSignal.timeout(20000) }); }
    catch (e) {
      console.error("confirmtkt fetch failed:", e && e.name, e && e.message);
      this.quota.refund(); this.calls--;
      throw new ProviderError("the data source did not answer");
    }
    if ([401, 403, 429].includes(res.status)) {
      console.error("confirmtkt refused:", res.status);
      await this.quota.block(res.status === 429 ? 900 : 3600);   // back off instead of retrying into a block
      throw new AccessDenied("the data source is refusing requests for now");
    }
    if (!res.ok) throw new ProviderError(`the data source returned an error (${res.status})`);
    try { return await res.json(); } catch (e) { throw new ProviderError("the data source sent an unreadable answer"); }
  }
  async pair(frm, to, on) {
    const id = `${frm}:${to}:${on}`;
    if (this.pairs.has(id)) return this.pairs.get(id);
    let rows = await this.kv.get(`c:p:${id}`, "json");
    if (!rows) {
      const data = await this.get("/search", { sourceStationCode: frm, destinationStationCode: to, addAvailabilityCache: "true", dateOfJourney: ddmmyyyy(on), enableNearby: "true", showPredictionGlobal: "true" });
      const list = (data && data.data && data.data.trainList) || [];
      rows = list.filter(r => r && r.trainNumber).map(r => ({
        number: String(r.trainNumber), name: titleCase(r.trainName), board: String(r.fromStnCode || frm).toUpperCase(), alight: String(r.toStnCode || to).toUpperCase(),
        classes: (r.avlClasses || []).map(c => String(c).toUpperCase()), depart: String(r.departureTime || ""), arrive: String(r.arrivalTime || ""),
        duration: Number.isInteger(r.duration) ? `${Math.floor(r.duration / 60)}:${String(r.duration % 60).padStart(2, "0")}` : "",
        gn: trimEntries(r.availabilityCache), tq: trimEntries(r.availabilityCacheTatkal),
      })).filter(r => /^[0-9A-Z]{3,6}$/.test(r.number));
      await this.kv.put(`c:p:${id}`, JSON.stringify(rows), { expirationTtl: TTL.avail });
      if (this.onFresh) this.onFresh(frm, to, on, rows);
    }
    this.pairs.set(id, rows);
    return rows;
  }
  async trainsBetween(frm, to, on) {
    return (await this.pair(frm, to, on)).map(({ gn, tq, ...hit }) => hit);
  }
  // per train, the saved status of every class in both quotas; free once the pair is loaded
  async classStatuses(frm, to, on) {
    const each = map => Object.fromEntries(Object.entries(map).map(([cls, e]) => [cls, ctEntry(e, on)]));
    return Object.fromEntries((await this.pair(frm, to, on)).map(r => [r.number, { GN: each(r.gn), TQ: each(r.tq) }]));
  }
  async schedule(trainNo) {
    const key = `c:cs:${trainNo}`;
    const hit = await this.kv.get(key, "json");
    if (hit) return hit;
    const data = await this.get("/schedule", { trainNo });
    const rows = data && data.Schedule;
    if (!Array.isArray(rows)) throw new ProviderError(`no route in schedule response for ${trainNo}`);
    const stops = [];
    for (const r of rows) {
      const code = String(r.StationCode || "").toUpperCase();
      if (!code) continue;
      let dep = hhmm(r.DepartureTime); if (dep === null) dep = hhmm(r.ArrivalTime);
      stops.push({ code, name: titleCase(r.StationName || code), seq: stops.length, day: parseInt(r.Day, 10) || 1, dep_min: dep });
    }
    if (stops.length < 2) throw new ProviderError(`schedule for ${trainNo} has fewer than two stops`);
    await this.kv.put(key, JSON.stringify(stops), { expirationTtl: TTL.schedule });
    return stops;
  }
  async availability(trainNo, frm, to, on, cls, quota) {
    const field = CT_FIELD[quota];
    if (!field) return { ...parseStatus(""), raw: `${quota} quota is not covered by this source` };
    const find = rows => rows.find(r => r.number === String(trainNo) && r.board === frm && r.alight === to);
    // the pair the user searched often already holds this train (Delhi has several terminals)
    let row = null;
    for (const rows of this.pairs.values()) { row = find(rows); if (row && Object.values(row[field])[0]?.d === on) break; row = null; }
    if (!row) row = find(await this.pair(frm, to, on));
    if (!row) return na("not offered for this station pair");
    const e = row[field][cls];
    return e ? ctEntry(e, on) : na("class not offered for this station pair");
  }
}
