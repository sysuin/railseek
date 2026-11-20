// Checks the Worker's engine gives the same answers as the Python package on demo data.
// Run from the project root:  node site/test/parity.mjs
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { search, serialize, parseStatus, istAt } from "../src/core.js";
import { DemoProvider } from "../src/providers.js";

const PY = `
import json, sys
from datetime import date, datetime
from railseek.engine import SearchRequest, search
from railseek.providers.demo import DemoProvider
from railseek.timeline import IST
from railseek.web import serialize
out = []
for case in json.loads(sys.argv[1]):
    req = SearchRequest(case["origin"], case["dest"], date.fromisoformat(case["on"]), classes=case["classes"], quotas=case["quotas"], trains=case["trains"], upstream=3, downstream=1, splits=case.get("splits", 0))
    p = DemoProvider()
    now = datetime.fromisoformat(case["now"]).astimezone(IST)
    out.append(serialize(search(p, req), req, p, now))
print(json.dumps(out))
`;

const cases = [];
for (const [origin, dest] of [["SSM", "NDLS"], ["SSM", "DLI"], ["GAYA", "CNB"], ["DDU", "NDLS"]])
  for (const train of ["90001", "90002", "90003"])
    for (const cls of ["SL", "3A", "2A", "1A"])
      for (const quota of ["GN", "TQ"])
        cases.push({ origin, dest, on: "2026-11-19", classes: [cls], quotas: [quota], trains: [train], now: "2026-11-17T09:30:00+05:30" });
cases.push({ origin: "SSM", dest: "NDLS", on: "2026-11-19", classes: [], quotas: ["GN"], trains: [], now: "2026-11-18T16:00:00+05:30" });
for (const train of ["90001", "90002", "90003"]) for (const splits of [1, 2]) for (const cls of ["SL", "3A"])
  cases.push({ origin: "SSM", dest: "NDLS", on: "2026-11-19", classes: [cls], quotas: ["GN"], trains: [train], splits, now: "2026-11-17T09:30:00+05:30" });
cases.push({ origin: "GAYA", dest: "DLI", on: "2026-11-19", classes: ["SL"], quotas: ["GN"], trains: ["90003"], splits: 2, now: "2026-11-17T09:30:00+05:30" });

const py = JSON.parse(execFileSync("python3", ["-c", PY, JSON.stringify(cases)], { maxBuffer: 1 << 26, cwd: new URL("../../", import.meta.url), stdio: ["ignore", "pipe", "inherit"] }));
const strip = o => ({
  ...o,
  sheets: o.sheets.map(s => ({ ...s, fields: s.fields.filter(f => f.label !== "Last seen") })),
});
let compared = 0;
for (const [i, c] of cases.entries()) {
  const now = Date.parse(c.now);
  const req = { origin: c.origin, dest: c.dest, on: c.on, also_from: [], also_to: [], classes: c.classes, quotas: c.quotas, trains: c.trains, upstream: 3, downstream: 1, splits: c.splits || 0 };
  const js = serialize(await search(new DemoProvider(now), req), req, true, now);
  const want = py[i];
  const tag = JSON.stringify(c);
  for (const k of ["origin", "dest", "date", "date_label", "trains_found", "checked", "skipped", "notes"]) assert.deepEqual(js[k], want[k], `${k} ${tag}`);
  assert.deepEqual(js.timelines, want.timelines, `timelines ${tag}`);
  assert.equal(js.options.length, want.options.length, `option count ${tag}`);
  js.options.forEach((o, n) => {
    const w = want.options[n];
    for (const k of ["id", "level", "kind", "train", "cls", "quota", "book_from", "book_to", "book_date", "board", "alight", "status", "chance", "how"]) assert.deepEqual(o[k], w[k], `${k} #${n} ${tag}`);
    assert.ok(Math.abs((o.fare ?? 0) - (w.fare ?? 0)) < 1e-6, `fare #${n} ${tag}`);
    assert.deepEqual(strip(o).sheets, strip(w).sheets, `sheet #${n} ${tag}`);
    compared++;
  });
}
assert.equal(parseStatus("RLWL67/WL23").count, 23);
assert.equal(new Date(istAt("2026-11-19", 898)).toISOString(), "2026-11-19T09:28:00.000Z");
console.log(`parity OK: ${cases.length} searches, ${compared} options identical to the Python version`);
