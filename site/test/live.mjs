// Live provider against a fake upstream: parsing, caching, allowance and refusal handling.
import assert from "node:assert/strict";
import { BudgetExceeded, ProviderError, search, serialize } from "../src/core.js";
import { ConfirmTktProvider, LiveProvider, Quota } from "../src/providers.js";

class FakeKV { m = new Map(); async get(k, t) { const v = this.m.get(k); return v === undefined ? null : t === "json" ? JSON.parse(v) : v; } async put(k, v) { this.m.set(k, v); } }
const now = Date.parse("2026-11-17T10:00:00+05:30");
const routes = {
  trainBetweenStations: { status: true, data: [{ train_number: "12801", train_name: "Purushottam Express ", from_std: "14:58", to_sta: "03:50", from: "SSM", to: "ANVT", duration: "12:52", class_type: ["SL", "3A"] }] },
  getTrainSchedule: { data: { route: [
    { station_code: "PURI", station_name: "PURI", day: 1, std_min: 1315, stop: true },
    { station_code: "XX", station_name: "pass", day: 1, std_min: 1320, stop: false },
    { station_code: "GAYA", station_name: "GAYA", day: 2, std_min: 2260, stop: true },
    { station_code: "SSM", station_name: "SASARAM", day: 2, std_min: 2338, stop: true },
    { station_code: "ANVT", station_name: "ANAND VIHAR", day: 3, std_min: 0, stop: true }] } },
};
const avail = (u) => ({ status: true, data: { availabilityClassList: [{ reservationClass: "3A", charges: { totalFare: u.get("fromStationCode") === "SSM" ? 1280 : 2025 },
  availabilities: [{ date: "2026-11-17", status: "NOT AVAILABLE" }, { date: "2026-11-18", status: u.get("fromStationCode") === "SSM" ? "RLWL67/WL23" : "GNWL12/WL4", prediction: 0.28 }] }] } });
let calls = 0, refuse = false;
const fetcher = async (url, init) => {
  calls++;
  assert.equal(init.headers["X-RapidAPI-Key"], "k");
  if (refuse) return new Response("{}", { status: 429, headers: { "x-ratelimit-basic-reset": "5000" } });
  const u = new URL(url), name = u.pathname.split("/").pop();
  return Response.json(name === "checkSeatAvailability" ? avail(u.searchParams) : routes[name]);
};
const kv = new FakeKV();
const mk = async (cap, perSearch = 8) => { const quota = await new Quota(kv, cap, now).load(); return { quota, p: new LiveProvider({ key: "k", kv, quota, perSearch, now, fetcher }) }; };
const req = { origin: "SSM", dest: "NDLS", on: "2026-11-18", also_from: [], also_to: [], classes: ["3A"], quotas: ["GN"], trains: ["12801"], upstream: 3, downstream: 1 };

let { quota, p } = await mk(10);
let out = serialize(await search(p, req), req, false, now);
await quota.save();
assert.equal(calls, 5, "trains + schedule + exact + 2 earlier origins");
assert.deepEqual(out.options.map(o => [o.book_from, o.book_date, o.status, o.level]), [
  // the fake source gives both the same 28% chance, so the simpler direct booking ranks first
  ["SSM", "2026-11-18", "RLWL67/WL23", "waitlist"], ["GAYA", "2026-11-18", "GNWL12/WL4", "waitlist"], ["PURI", "2026-11-17", "NOT AVAILABLE", "closed"]]);
assert.equal(out.options[0].chance, 28); assert.equal(out.options[0].fare, 1280);
assert.equal(quota.remaining, 5);

({ quota, p } = await mk(10));           // same search again: all cached, nothing spent
await search(p, req); assert.equal(calls, 5); assert.equal(quota.remaining, 5);

kv.m.clear(); calls = 0;                 // allowance smaller than the search
({ quota, p } = await mk(3));
out = serialize(await search(p, req), req, false, now);
assert.equal(calls, 3); assert.equal(out.options.length, 1); assert.match(out.notes.join(" "), /allowance is used up/);
await assert.rejects((await mk(0)).p.trainsBetween("A", "B", "2026-11-18"), BudgetExceeded);

kv.m.clear(); calls = 0; refuse = true;  // upstream refuses: block further use, do not keep calling
({ quota, p } = await mk(10));
out = await search(p, req);
assert.equal(calls, 1); assert.match(out.notes.join(" "), /refused/);
assert.equal((await new Quota(kv, 10, now).load()).remaining, 0);

kv.m.clear(); refuse = false;            // network failure: nothing is charged to the allowance
({ quota } = await mk(10));
const broken = new LiveProvider({ key: "k", kv, quota, perSearch: 8, now, fetcher: async () => { throw new TypeError("boom"); } });
await assert.rejects(broken.trainsBetween("A", "B", "2026-11-18"), /did not answer/);
assert.equal(quota.remaining, 10); assert.equal(quota.spent, 0);
assert.doesNotThrow(() => new LiveProvider({ key: "k", kv, quota, perSearch: 8, now }));

/* ---------- ConfirmTkt source ---------- */
const E = (a, p, f, t = "2026-11-18T10:14:02.001", d = "2026-11-18T00:00:00") => ({ availability: a, predictionPercentage: p, fare: String(f), date: d, cacheTime: t });
const ctPairs = {
  "SSM:NDLS": [{ trainNumber: "12801", trainName: "PURUSHOTTAM SF", fromStnCode: "SSM", toStnCode: "ANVT", departureTime: "14:58", arrivalTime: "03:50", duration: 772, avlClasses: ["3A", "SL"],
    availabilityCache: { "3A": E("REGRET", 0, 1280), SL: E("RLWL85/WL41", 20, 480) }, availabilityCacheTatkal: { "3A": E("NOT AVAILABLE", 0, 0), SL: E("AVAILABLE-0072#", 0, 640) } }],
  "PURI:ANVT": [{ trainNumber: "12801", trainName: "PURUSHOTTAM SF", fromStnCode: "PURI", toStnCode: "ANVT", duration: 1795, avlClasses: ["3A"], availabilityCache: { "3A": E("GNWL40/WL12", 61, 2025, undefined, "2026-11-17T00:00:00") } }],
  "DOS:ANVT": [{ trainNumber: "12801", trainName: "PURUSHOTTAM SF", fromStnCode: "DOS", toStnCode: "ANVT", duration: 790, avlClasses: ["3A"], availabilityCache: { "3A": E("RLWL9/WL5", 44, 1290) } }],
  "GAYA:ANVT": [],
};
const ctSched = { Schedule: [["PURI", 1, "21:55"], ["GAYA", 2, "13:40"], ["DOS", 2, "14:42"], ["SSM", 2, "14:58"], ["ANVT", 3, ""]].map(([c, Day, t]) => ({ StationCode: c, StationName: c, Day, DepartureTime: t, ArrivalTime: t || "03:50" })) };
let ctCalls = [];
const ctFetch = async (url, init) => {
  const u = new URL(url); ctCalls.push(u.pathname.split("/").pop() + ":" + (u.searchParams.get("sourceStationCode") || u.searchParams.get("trainNo")));
  assert.equal(init.headers["X-RapidAPI-Key"], undefined);
  if (u.pathname.endsWith("/schedule")) return Response.json(ctSched);
  assert.match(u.searchParams.get("dateOfJourney"), /^\d\d-\d\d-\d{4}$/);
  return Response.json({ data: { trainList: ctPairs[`${u.searchParams.get("sourceStationCode")}:${u.searchParams.get("destinationStationCode")}`] || [] } });
};
const ckv = new FakeKV();
const mkct = async (cap = 100) => { const q = await new Quota(ckv, cap, now, "day", "ct:").load(); return { q, p: new ConfirmTktProvider({ kv: ckv, quota: q, perSearch: 8, fetcher: ctFetch }) }; };
let c = await mkct();
const trainsCt = await c.p.trainsBetween("SSM", "NDLS", "2026-11-18");
assert.deepEqual(trainsCt.map(t => [t.number, t.name, t.alight, t.duration, t.gn]), [["12801", "Purushottam Sf", "ANVT", "12:52", undefined]]);
const reqCt = { ...req, classes: ["3A"] };
out = serialize(await search(c.p, reqCt), reqCt, false, now); await c.q.save();
assert.deepEqual(ctCalls, ["search:SSM", "schedule:12801", "search:PURI", "search:DOS", "search:GAYA"], "exact pair reused from the train list");
assert.deepEqual(out.options.map(o => [o.book_from, o.book_date, o.status, o.level, o.chance, o.fare, o.as_of]), [
  ["PURI", "2026-11-17", "GNWL40/WL12", "waitlist", 61, 2025, "2026-11-18T10:14:02+05:30"],
  ["DOS", "2026-11-18", "RLWL9/WL5", "waitlist", 44, 1290, "2026-11-18T10:14:02+05:30"],
  ["SSM", "2026-11-18", "REGRET", "closed", null, 1280, "2026-11-18T10:14:02+05:30"],
  ["GAYA", "2026-11-18", "not offered for this station pair", "closed", null, null, ""]]);
const tq = { ...req, classes: ["SL"], quotas: ["TQ"] };
c = await mkct(); ctCalls = [];
out = serialize(await search(c.p, tq), tq, false, now);
assert.equal(out.options[0].status, "AVAILABLE-0072#"); assert.equal(out.options[0].level, "available");
assert.deepEqual(ctCalls, [], "second visitor is served from the shared cache");
assert.equal((await new Quota(ckv, 100, now, "day", "ct:").load()).used, 5);
assert.equal((await new Quota(ckv, 100, now).load()).used, 0, "RapidAPI and ConfirmTkt counters are separate");

/* top-5 batch: all classes, both quotas, direct plus the train's first station */
c = await mkct(); ctCalls = [];
const topReq = { ...req, classes: [], quotas: ["GN", "TQ"], trains: ["12801"], upstream: 1, downstream: 0 };
const topRes = await search(c.p, topReq);
assert.deepEqual(ctCalls, [], "nothing new is fetched: train list, route and origin pair are already cached");
out = serialize({ ...topRes, options: topRes.options.filter(o => o.score > 0).slice(0, 8) }, topReq, false, now);
assert.deepEqual(out.options.map(o => [o.cls, o.quota, o.book_from, o.status]), [
  ["SL", "TQ", "SSM", "AVAILABLE-0072#"], ["3A", "GN", "PURI", "GNWL40/WL12"], ["SL", "GN", "SSM", "RLWL85/WL41"]]);
assert.ok(out.options[0].score > out.options[1].score && out.options[1].score > out.options[2].score);
console.log("live provider OK");

/* ---------- flexible dates, connections, fallback, health (demo and fake upstream) ---------- */
import { DemoProvider } from "../src/providers.js";
import { FallbackProvider, connections, flexibleDates, healthCheck, pickHubs } from "../src/plans.js";
{
  const t0 = Date.parse("2026-11-18T09:00:00+05:30");
  const demo = new DemoProvider(t0);
  const days = await flexibleDates(demo, { origin: "SSM", dest: "NDLS", on: "2026-11-19" }, t0);
  assert.deepEqual(days.map(d => [d.date, d.selected, d.trains, d.open]), [["2026-11-18", false, 2, 2], ["2026-11-19", true, 2, 2], ["2026-11-20", false, 2, 2], ["2026-11-21", false, 2, 2]]);
  assert.equal(days[1].best.label, "WL 4");   // only the direct pair is used here: 1A PQWL5/WL4 at 45%
  const todayOnly = await flexibleDates(demo, { origin: "SSM", dest: "NDLS", on: "2026-11-18" }, t0);
  assert.equal(todayOnly[0].date, "2026-11-18", "never offers a past date");

  assert.deepEqual(pickHubs([await demo.schedule("90001")], "SSM", "NDLS"), ["DDU", "PRYJ"]);
  const c = await connections(demo, { origin: "SSM", dest: "NDLS", on: "2026-11-19" }, t0);
  assert.deepEqual(c.hubs, ["DDU", "PRYJ"]);
  assert.ok(c.connections.length > 0, "demo has a connection via DDU onto 90004");
  const first = c.connections[0];
  assert.equal(first.legs[1].train, "90004"); assert.equal(first.hub, "DDU");
  assert.ok(first.gap >= 60 && first.gap <= 480, `gap ${first.gap}`);
  assert.ok(c.connections.every(x => x.legs[0].train !== x.legs[1].train));
  // leg 1 on 90002 leaves SSM 15:28, reaches DDU 17:15 (1:47), leg 2 leaves 19:30: gap 2 h 15 min
  const via2 = c.connections.find(x => x.legs[0].train === "90002");
  assert.equal(via2.gap, 135); assert.equal(via2.tight, false);

  // fallback: primary fails, backup answers; budget errors are not treated as failures
  const broken = { name: "x", calls: 0, trainsBetween: async () => { throw new ProviderError("down"); }, classStatuses: async () => { throw new ProviderError("down"); } };
  let made = 0;
  const fb = new FallbackProvider(broken, async () => { made++; return demo; });
  assert.equal((await fb.trainsBetween("SSM", "NDLS", "2026-11-19")).length, 2);
  assert.deepEqual(await fb.classStatuses("SSM", "NDLS", "2026-11-19"), {});
  assert.equal(made, 1);
  const none = new FallbackProvider(broken, async () => null);
  await assert.rejects(none.trainsBetween("A", "B", "2026-11-19"), /no backup/);
  const capped = new FallbackProvider({ name: "x", calls: 0, trainsBetween: async () => { throw new BudgetExceeded("cap"); } }, async () => { throw new Error("must not be called"); });
  await assert.rejects(capped.trainsBetween("A", "B", "2026-11-19"), /cap/);

  assert.deepEqual(await healthCheck(() => broken, t0), { ok: false, trains: 0, parsed_statuses: 0, problem: "down" });
  const good = await healthCheck(() => ({ trainsBetween: demo.trainsBetween.bind(demo), classStatuses: demo.classStatuses.bind(demo) }), t0);
  assert.equal(good.ok, false, "demo knows no NDLS-HWH trains, so this reads as unhealthy");
  console.log("dates, connections, fallback, health OK");
}

/* ---------- alerts: change detection, push endpoint check, VAPID signature ---------- */
import { describeChange } from "../src/alerts.js";
import { validEndpoint, vapidAuth } from "../src/push.js";
{
  const a = { train: "04063", cls: "2A", quota: "GN", book_from: "SSM", book_to: "NDLS", book_date: "2026-11-21", rank: 1, label: "WL 12", wl: 12 };
  const st = (level, label, count, chance = null) => [{ level, label, chance }, { count }];
  assert.match(describeChange(a, ...st("available", "3 seats", 3)).title, /^Seats opened/);
  assert.match(describeChange(a, ...st("rac", "RAC 4", 4)).title, /^Seats opened/);
  assert.match(describeChange(a, ...st("waitlist", "WL 8", 8, 70)).title, /^Waitlist moving/);
  assert.equal(describeChange(a, ...st("waitlist", "WL 10", 10)), null, "a small move is not worth a notification");
  assert.equal(describeChange(a, ...st("waitlist", "WL 15", 15)), null);
  assert.match(describeChange({ ...a, rank: 3, label: "2 seats", wl: null }, ...st("waitlist", "WL 1", 1)).title, /^Seats gone/);
  assert.match(describeChange({ ...a, rank: 0, label: "Regret", wl: null }, ...st("waitlist", "WL 2", 2)).title, /^Booking opened/);

  assert.ok(validEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
  assert.ok(validEndpoint("https://web.push.apple.com/QW1"));
  assert.ok(validEndpoint("https://wns2-pn1p.notify.windows.com/w/?token=x"));
  assert.ok(!validEndpoint("https://evil.example/fcm.googleapis.com/"));
  assert.ok(!validEndpoint("http://127.0.0.1:9/x"));
  assert.ok(validEndpoint("http://127.0.0.1:9/x", { ALLOW_TEST_PUSH: "1" }));

  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await subtle.exportKey("jwk", kp.privateKey);
  const pub = Buffer.from(await subtle.exportKey("raw", kp.publicKey)).toString("base64url");
  const auth = await vapidAuth("https://fcm.googleapis.com/fcm/send/abc", { VAPID_PRIVATE_JWK: JSON.stringify(jwk), VAPID_PUBLIC: pub }, Date.parse("2026-11-20T00:00:00Z"));
  const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
  assert.equal(k, pub);
  const [h, c, s] = t.split(".");
  assert.ok(await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${c}`)));
  assert.equal(JSON.parse(Buffer.from(c, "base64url")).aud, "https://fcm.googleapis.com");
  console.log("alerts OK");
}

/* ---------- waitlist history rows ---------- */
import { historyRows } from "../src/history.js";
{
  const rows = [{ number: "12801", board: "SSM", alight: "ANVT", gn: { "3A": { a: "RLWL67/WL23", p: 28, f: 1280, d: "2026-11-21", t: "2026-11-20T10:14:02" }, SL: { a: "REGRET", p: 0, f: 480, d: "2026-11-22", t: "2026-11-20T10:14:02" } } }];
  const out = historyRows("SSM", "NDLS", "2026-11-21", rows);
  assert.equal(out.length, 1, "only rows for the requested date");
  assert.deepEqual(out[0], ["12801|SSM|ANVT|2026-11-21|3A|GN", "2026-11-21", Math.floor(Date.parse("2026-11-20T10:14:02+05:30") / 3600000), "RLWL67/WL23", 28]);
  console.log("history OK");
}

/* ---------- route alerts ---------- */
import { describeRouteChange, routeBest } from "../src/alerts.js";
{
  const S = (raw, p = null) => { const a = { kind: /AVAIL/.test(raw) ? "AVAILABLE" : /RAC/.test(raw) ? "RAC" : /WL/.test(raw) ? "WL" : "REGRET", raw, count: +(raw.match(/(\d+)$/) || [0, 0])[1], probability: p, fare: null, fetched_at: "" }; return a; };
  const st = { "12801": { GN: { "3A": S("RLWL40/WL20", 60), SL: S("REGRET") }, TQ: { SL: S("AVAILABLE-0050") } }, "04063": { GN: { "2A": S("GNWL10/WL2", 94), SL: S("AVAILABLE-0004") }, TQ: {} } };
  let b = routeBest(st, [], "GN", false);
  assert.equal(b.rank, 3); assert.equal(b.label, "04063 SL: 4 seats"); assert.equal(b.open, 1);
  b = routeBest(st, ["2A", "3A"], "GN", false);
  assert.equal(b.rank, 1); assert.equal(b.label, "04063 2A: WL 2", "the waitlist with the better chance");
  assert.equal(routeBest(st, [], "TQ", false).rank, 3, "Tatkal not open yet: general quota is used");
  assert.equal(routeBest(st, [], "TQ", true).label, "12801 SL: 50 seats");
  const a = { book_from: "SSM", book_to: "NDLS", book_date: "2026-11-25", rank: 1, label: "04063 2A: WL 2" };
  assert.match(describeRouteChange(a, routeBest(st, [], "GN", false)).title, /^Seats on SSM-NDLS/);
  assert.equal(describeRouteChange(a, { rank: 1, label: "x" }), null);
  assert.match(describeRouteChange({ ...a, rank: 3, label: "04063 SL: 4 seats" }, { rank: 1, label: "04063 2A: WL 2" }).title, /^Seats gone/);
  console.log("route alerts OK");
}
