// Live provider against a fake upstream: parsing, caching, allowance and refusal handling.
import assert from "node:assert/strict";
import { BudgetExceeded, search, serialize } from "../src/core.js";
import { LiveProvider, Quota } from "../src/providers.js";

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
  ["GAYA", "2026-11-18", "GNWL12/WL4", "waitlist"], ["SSM", "2026-11-18", "RLWL67/WL23", "waitlist"], ["PURI", "2026-11-17", "NOT AVAILABLE", "closed"]]);
assert.equal(out.options[1].chance, 28); assert.equal(out.options[1].fare, 1280);
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
console.log("live provider OK");
