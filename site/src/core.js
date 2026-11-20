// Search engine, rule calendar and booking sheet. A port of the Python package
// in ../railseek (engine.py, status.py, timeline.py, handoff.py); test/parity.mjs
// checks the two give the same answers on demo data. Read-only: nothing here
// talks to IRCTC.

export const ALL_CLASSES = ["SL", "3E", "3A", "2A", "1A", "CC", "2S"];
export const AC_CLASSES = new Set(["1A", "2A", "3A", "3E", "CC", "EC", "EA"]);
const TIER = { exact: 0, "earlier-origin": 1, "later-destination": 2, "alt-station": 3, "both-extended": 4, "split-leg": 5 };
const RANK = { AVAILABLE: 3, RAC: 2, WL: 1 };
const QUOTA_NAMES = { GN: "General", TQ: "Tatkal", PT: "Premium Tatkal", LD: "Ladies", SS: "Senior citizen / lower berth" };
export const IRCTC_URL = "https://www.irctc.co.in/nget/train-search";

export class ProviderError extends Error {}
export class BudgetExceeded extends ProviderError {}
export class AccessDenied extends ProviderError {}

/* ---------- dates: plain ISO days plus epoch ms, shown in IST ---------- */
const IST_MIN = 330;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = n => String(n).padStart(2, "0");
const dayMs = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const addDays = (iso, n) => new Date(dayMs(iso) + n * 86400000).toISOString().slice(0, 10);
export const istAt = (iso, minutes) => dayMs(iso) + (minutes - IST_MIN) * 60000;
export const istToday = now => new Date(now + IST_MIN * 60000).toISOString().slice(0, 10);
const parts = ms => {
  const d = new Date(ms + IST_MIN * 60000);
  return { a: DOW[d.getUTCDay()], d: p2(d.getUTCDate()), b: MON[d.getUTCMonth()], Y: d.getUTCFullYear(), H: p2(d.getUTCHours()), M: p2(d.getUTCMinutes()) };
};
export const fmt = (ms, f) => { const p = parts(ms); return f.replace(/%([adbYHM])/g, (_, k) => p[k]); };
export const fmtDay = (iso, f) => fmt(istAt(iso, 720), f);
export const isoStamp = ms => { const p = new Date(ms + IST_MIN * 60000).toISOString(); return p.slice(0, 19) + "+05:30"; };

/* ---------- status ---------- */
const WL_RE = /\b([A-Z]{0,2}WL)\s*(\d+)(?:\s*\/\s*[A-Z]*WL\s*(\d+))?/;
const RAC_RE = /RAC\s*(\d+)(?:\s*\/\s*RAC\s*(\d+))?/;
const AVL_RE = /(?:AVAILABLE|AVBL|AVL)\D{0,3}(\d+)/;

export function parseStatus(raw) {
  const text = (raw || "").toUpperCase().trim();
  const a = { raw: raw || "", kind: "UNKNOWN", count: null, wl_type: "", wl_running: null, probability: null, fare: null, fetched_at: "" };
  if (!text) return a;
  if (text.includes("REGRET")) return { ...a, kind: "REGRET" };
  if (text.includes("DEPARTED")) return { ...a, kind: "DEPARTED" };
  if (text.includes("NOT AVAILABLE") || text.includes("NOT EXIST") || text.includes("SUSPENDED")) return { ...a, kind: "NA" };
  let m = AVL_RE.exec(text);
  if (m) return { ...a, kind: "AVAILABLE", count: +m[1] };
  m = RAC_RE.exec(text);
  if (m) return { ...a, kind: "RAC", count: +(m[2] || m[1]) };
  m = WL_RE.exec(text);
  if (m) return { ...a, kind: "WL", count: m[3] ? +m[3] : +m[2], wl_type: m[1] !== "WL" ? m[1] : "", wl_running: +m[2] };
  if (text.includes("AVAILABLE") || text.includes("AVBL")) return { ...a, kind: "AVAILABLE" };
  return a;
}

export function score(avail, tier = 0) {
  if (!avail) return -1;
  const penalty = tier * 5;
  if (avail.kind === "AVAILABLE") return 1000 + Math.min(avail.count || 1, 50) - penalty;
  if (avail.kind === "RAC") return 800 - Math.min(avail.count || 0, 100) - penalty;
  if (avail.kind === "WL") {
    const pos = avail.count || 0;
    if (avail.probability !== null) return 400 + avail.probability - penalty;  // the source's estimate already reflects the waitlist type
    return 400 + Math.max(0, 100 - 3 * pos) + ({ GNWL: 20, TQWL: -20 }[avail.wl_type] || 0) - penalty;
  }
  if (["REGRET", "NA", "DEPARTED"].includes(avail.kind)) return 0;
  return -1;
}
const isBookable = a => !!a && ["AVAILABLE", "RAC", "WL"].includes(a.kind);

// Short form of a status for a small chip: level drives the colour, label is the text.
export function brief(a) {
  if (!a) return null;
  const level = { AVAILABLE: "available", RAC: "rac", WL: "waitlist", REGRET: "closed", NA: "closed", DEPARTED: "closed" }[a.kind] || "";
  if (!level) return null;
  const label = a.kind === "AVAILABLE" ? (a.count !== null ? `${a.count} seat${a.count === 1 ? "" : "s"}` : "Available")
    : a.kind === "RAC" ? `RAC ${a.count ?? ""}`.trim()
    : a.kind === "WL" ? `WL ${a.count ?? ""}`.trim()
    : a.kind === "REGRET" ? "Regret" : a.kind === "DEPARTED" ? "Departed" : "N/A";
  return { level, label, raw: a.raw, chance: a.kind === "WL" ? a.probability : null, fare: a.fare, as_of: a.fetched_at };
}

/* ---------- planning ---------- */
const pyRound = x => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1; };
const range = (a, b, step = 1) => { const o = []; for (let i = a; step > 0 ? i < b : i > b; i += step) o.push(i); return o; };
function pick(indices, limit) {
  const out = [];
  for (const i of indices) { if (out.length >= limit) break; if (!out.includes(i)) out.push(i); }
  return out;
}
function indexOf(stops, code, after = -1) {
  for (let i = 0; i < stops.length; i++) if (i > after && stops[i].code === code) return i;
  return null;
}

export function planCandidates(hit, stops, req, primary) {
  const base = req.classes.length ? req.classes : hit.classes.length ? hit.classes : ALL_CLASSES;
  const classes = base.filter(c => !hit.classes.length || hit.classes.includes(c));
  const out = [];
  const add = (kind, frm, to, on, group = "") => {
    for (const cls of classes) for (const quota of req.quotas)
      out.push({ train: hit, kind, tier: TIER[kind], book_from: frm, book_to: to, board: hit.board, alight: hit.alight, book_date: on, cls, quota, split_group: group, avail: null });
  };
  add(primary ? "exact" : "alt-station", hit.board, hit.alight, req.on);
  if (!primary || !stops) return out;
  const b = indexOf(stops, hit.board);
  const a = indexOf(stops, hit.alight, b === null ? -1 : b);
  if (b === null || a === null) return out;
  const dateAt = i => addDays(req.on, stops[i].day - stops[b].day);
  const spread = req.upstream > 1 ? range(1, req.upstream).map(i => pyRound((b * i) / req.upstream)).filter(i => i < b) : [];
  const ups = b > 0 ? pick([0, b - 1, ...spread, ...range(b - 1, 0, -1)], req.upstream) : [];
  const last = stops.length - 1;
  const downs = a < last ? pick([last, ...range(a + 1, last)], req.downstream) : [];
  for (const u of ups) add("earlier-origin", stops[u].code, hit.alight, dateAt(u));
  for (const d of downs) add("later-destination", hit.board, stops[d].code, req.on);
  if (ups.length && downs.length) add("both-extended", stops[ups[0]].code, stops[downs[0]].code, dateAt(ups[0]));
  // two tickets on the same train, split at a midway station
  const between = range(b + 1, a);
  if (req.splits && between.length) {
    const step = Math.max(1, Math.floor(between.length / (req.splits + 1)));
    const spaced = between.filter((_, i) => i >= step - 1 && (i - (step - 1)) % step === 0);
    for (const x of pick(spaced.length ? spaced : between, req.splits)) {
      const group = `${hit.number}:${stops[x].code}`;
      add("split-leg", hit.board, stops[x].code, req.on, group);
      add("split-leg", stops[x].code, hit.alight, dateAt(x), group);
    }
  }
  return out;
}

const candKey = c => [c.train.number, c.board, c.alight, c.cls, c.quota].join("|");

export async function search(provider, req) {
  const notes = [];
  const origins = [req.origin, ...req.also_from.filter(s => s !== req.origin)];
  const dests = [req.dest, ...req.also_to.filter(s => s !== req.dest)];
  const hits = new Map();
  let stopped = false;
  for (const o of origins) {
    for (const d of dests) {
      if (stopped) break;
      let found;
      try { found = await provider.trainsBetween(o, d, req.on); }
      catch (e) {
        if (e instanceof AccessDenied || e instanceof BudgetExceeded) { notes.push(`Stopped looking for trains: ${e.message}`); stopped = true; break; }
        if (e instanceof ProviderError) { notes.push(`Train list ${o}->${d} failed: ${e.message}`); continue; }
        throw e;
      }
      for (const h of found) {
        if (req.trains.length && !req.trains.includes(h.number)) continue;
        const k = `${h.number}|${o}`;
        if (!hits.has(k)) hits.set(k, [h, o === req.origin]);
      }
    }
  }
  const trainsFound = new Set([...hits.keys()].map(k => k.split("|")[0])).size;

  const schedules = {};
  let candidates = [];
  for (const [hit, primary] of hits.values()) {
    if (primary && !(hit.number in schedules)) {
      try { schedules[hit.number] = await provider.schedule(hit.number); }
      catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        notes.push(`No route for ${hit.number}, checking the exact station pair only: ${e.message}`);
        schedules[hit.number] = null;
      }
    }
    candidates.push(...planCandidates(hit, schedules[hit.number] || null, req, primary));
  }
  const order = req.classes.length ? req.classes : ALL_CLASSES;
  const rank = c => { const i = order.indexOf(c.cls); return i < 0 ? 99 : i; };
  candidates = candidates.map((c, i) => [c, i]).sort((x, y) => x[0].tier - y[0].tier || rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]);

  const memo = new Map(), exactOpen = new Set();
  let checked = 0, skipped = 0, halted = "";
  for (const c of candidates) {
    if (c.tier > 0 && c.kind !== "alt-station" && exactOpen.has(candKey(c))) continue;
    if (halted) { skipped++; continue; }
    const k = [c.train.number, c.book_from, c.book_to, c.book_date, c.cls, c.quota].join("|");
    if (!memo.has(k)) {
      try { memo.set(k, await provider.availability(c.train.number, c.book_from, c.book_to, c.book_date, c.cls, c.quota)); checked++; }
      catch (e) {
        if (e instanceof AccessDenied || e instanceof BudgetExceeded) { halted = e.message; skipped++; continue; }
        if (!(e instanceof ProviderError)) throw e;
        memo.set(k, { ...parseStatus(""), raw: e.message.slice(0, 60), kind: "ERROR" });
      }
    }
    c.avail = memo.get(k);
    if (c.kind === "exact" && c.avail.kind === "AVAILABLE") exactOpen.add(candKey(c));
  }
  if (halted) notes.push(`Stopped early (${halted}); ${skipped} checks were not made.`);

  const options = [], groups = new Map();
  for (const c of candidates) {
    if (!c.avail) continue;
    if (c.kind === "split-leg") {
      const k = [c.split_group, c.cls, c.quota].join("|");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    } else options.push({ legs: [c], score: score(c.avail, c.tier), kind: c.kind });
  }
  for (const legs of groups.values())
    if (legs.length === 2 && legs.every(l => isBookable(l.avail)))
      options.push({ legs, score: Math.min(...legs.map(l => score(l.avail, l.tier))), kind: "split" });
  options.sort((x, y) => y.score - x.score);
  return { options, notes, trainsFound, checked, skipped, hits: [...hits.values()], schedules };
}

/* ---------- rule calendar ---------- */
export function buildTimeline(stops, board, journeyDate, classes) {
  const b = stops.find(s => s.code === board), origin = stops[0];
  if (!b || b.dep_min === null || origin.dep_min === null) return null;
  const boardDep = istAt(journeyDate, b.dep_min);
  const originDate = addDays(journeyDate, -(b.day - origin.day));
  const originDep = istAt(originDate, origin.dep_min);
  classes = classes && classes.length ? classes : ["3A", "SL"];
  const ev = [];
  const tatkalDay = addDays(originDate, -1);
  let basis = "";
  if (originDate !== journeyDate) {
    const alt = addDays(journeyDate, -1);
    basis = `Counted from the day the train starts at ${origin.code} (${fmtDay(originDate, "%d %b")}), so it opens on ${fmtDay(tatkalDay, "%d %b")}. ` +
      `Some sources count from your boarding date, which would make it open on ${fmtDay(alt, "%d %b")}. Check on IRCTC.`;
  }
  if (classes.some(c => AC_CLASSES.has(c))) ev.push({ when: istAt(tatkalDay, 600), kind: "tatkal-ac", label: "Tatkal opens for AC classes", note: basis });
  if (classes.some(c => !AC_CLASSES.has(c))) ev.push({ when: istAt(tatkalDay, 660), kind: "tatkal-nonac", label: "Tatkal opens for non-AC classes", note: basis });
  const prev = addDays(originDate, -1);
  const morning = origin.dep_min <= 14 * 60;
  ev.push({ when: istAt(prev, morning ? 720 : 960), kind: "emergency-quota", label: "Emergency quota request deadline",
    note: "Needs a genuine forwarding authority. Based on the train's departure from its first station." });
  const chart = origin.dep_min > 300 && origin.dep_min <= 840 ? istAt(prev, 1200) : originDep - 10 * 3600000;
  ev.push({ when: chart, kind: "first-chart", label: "First chart due; leftover berths go on sale as current booking",
    note: `Estimated from the train's departure from ${origin.code}. Stations far down the route can have their own later chart.` });
  ev.push({ when: boardDep - 30 * 60000, kind: "current-closes", label: "Current booking closes (about 30 minutes before departure)",
    note: `Whether this runs up to departure from ${board} or from an earlier station is unconfirmed.` });
  const rn = "Confirmed Tatkal tickets are never refundable.";
  ev.push({ when: boardDep - 72 * 3600000, kind: "refund-25", label: "From now, cancelling costs 25% of the fare", note: rn });
  ev.push({ when: boardDep - 24 * 3600000, kind: "refund-50", label: "From now, cancelling costs 50% of the fare", note: rn });
  ev.push({ when: boardDep - 8 * 3600000, kind: "refund-0", label: "From now, cancelling gives no refund", note: rn });
  ev.push({ when: boardDep, kind: "departure", label: `Train leaves ${board}`, note: "" });
  return ev.map((e, i) => [e, i]).sort((x, y) => x[0].when - y[0].when || x[1] - y[1]).map(x => x[0]);
}

export function relative(when, now) {
  const secs = Math.floor((when - now) / 1000);
  if (secs < 0) return "passed";
  const days = Math.floor(secs / 86400), hours = Math.floor((secs % 86400) / 3600), mins = Math.floor((secs % 3600) / 60);
  if (days) return `in ${days}d ${hours}h`;
  if (hours) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

/* ---------- booking sheet ---------- */
function boardingDate(c, stops) {
  if (!stops) return c.board === c.book_from ? c.book_date : null;
  const frm = stops.find(s => s.code === c.book_from), brd = stops.find(s => s.code === c.board);
  if (!frm || !brd) return null;
  return addDays(c.book_date, brd.day - frm.day);
}

export function checklist(tatkal) {
  const items = [
    "IRCTC login works on the device you will use (try it today, not at booking time).",
    "Passengers are saved in My Profile > Master List, with names and ages exactly as on their ID.",
    "Payment is ready: IRCTC eWallet topped up, or a UPI app open on your phone. Avoid cards that need a slow bank OTP.",
    "Decide now whether to tick Vikalp (alternate train) and auto-upgrade, so you do not stop to think on the form.",
    "Have a second choice from the search results written down in case the first is gone.",
  ];
  return tatkal ? [
    "Your IRCTC account is Aadhaar-authenticated (My Profile > Authenticate User). Tatkal is refused without it.",
    "The phone linked to your Aadhaar is next to you and has signal, for the booking OTP.",
    "Log in 3 to 5 minutes before opening time. Earlier risks a session timeout; later risks the login queue.",
    "At most 4 passengers per Tatkal booking. A confirmed Tatkal ticket cannot be refunded.",
    ...items] : items;
}

export function sheetData(c, stops, now) {
  const tatkal = c.quota === "TQ" || c.quota === "PT";
  const shiftedFrom = c.book_from !== c.board, shiftedTo = c.book_to !== c.alight;
  const travel = boardingDate(c, stops);
  const qn = QUOTA_NAMES[c.quota] || c.quota;
  const name = c.train.name.trim() ? ` ${c.train.name.trim()}` : "";
  const fields = [
    ["Train", `${c.train.number}${name}`, ""],
    ["From", c.book_from, shiftedFrom ? `(not ${c.board}: you book from an earlier station)` : ""],
    ["To", c.book_to, shiftedTo ? `(not ${c.alight}: you book past your stop)` : ""],
    ["Date", fmtDay(c.book_date, "%a %d %b %Y"), shiftedFrom && travel && travel !== c.book_date ? `(the day the train leaves ${c.book_from}; you board on ${fmtDay(travel, "%d %b")})` : ""],
    ["Class", c.cls, ""],
    ["Quota", `${qn} (${c.quota})`, ""],
  ];
  if (shiftedFrom) fields.push(["Boarding", c.board, "<- must be set, or your berth can be given away"]);
  if (c.avail) {
    const extra = [];
    if (c.avail.probability !== null && c.avail.kind === "WL") extra.push(`${Math.round(c.avail.probability)}% chance`);
    if (c.avail.fare !== null) extra.push(`about Rs ${Math.round(c.avail.fare)} per adult`);
    const when = c.avail.fetched_at ? ` at ${c.avail.fetched_at.slice(11, 16)} on ${c.avail.fetched_at.slice(0, 10)}` : "";
    fields.push(["Last seen", `${c.avail.raw || c.avail.kind}${when}` + (extra.length ? ` (${extra.join(", ")})` : ""), ""]);
  }
  const events = stops && travel ? buildTimeline(stops, c.board, travel, [c.cls]) || [] : [];
  const by = Object.fromEntries(events.map(e => [e.kind, e]));
  const timing = [];
  if (tatkal) {
    const opens = by[AC_CLASSES.has(c.cls) ? "tatkal-ac" : "tatkal-nonac"];
    if (opens) { timing.push(`Tatkal opens ${fmt(opens.when, "%a %d %b at %H:%M")} (${relative(opens.when, now)}).`); if (opens.note) timing.push(opens.note); }
    else timing.push(`Tatkal opens at ${AC_CLASSES.has(c.cls) ? "10:00" : "11:00"} the day before the train starts its run.`);
  }
  const dep = by.departure;
  if (dep) {
    timing.push(`Train leaves ${c.board} ${fmt(dep.when, "%a %d %b at %H:%M")} (${relative(dep.when, now)}).`);
    if (!tatkal) {
      if (now >= by["refund-0"].when) timing.push("Refund: none if you cancel from now on.");
      else if (now >= by["refund-50"].when) timing.push(`Refund: cancelling now loses 50% of the fare; nothing back after ${fmt(by["refund-0"].when, "%a %H:%M")}.`);
      else if (now >= by["refund-25"].when) timing.push(`Refund: cancelling now loses 25% of the fare; 50% after ${fmt(by["refund-50"].when, "%a %H:%M")}.`);
    }
  }
  const steps = [
    `Open IRCTC (${IRCTC_URL}) or the IRCTC Rail Connect app and log in.`,
    `Search From ${c.book_from}, To ${c.book_to}, date ${fmtDay(c.book_date, "%d %b %Y")}, quota ${qn}.`,
    `Find train ${c.train.number}, choose class ${c.cls}, and check the status shown matches what you expect.`,
    "Pick passengers from your Master List.",
  ];
  if (shiftedFrom) steps.push(`On the passenger page, set the boarding station to ${c.board}. If the page does not offer it, change it afterwards under Booked Ticket History > Change Boarding Point (allowed once).`);
  steps.push("Review the fare, pay, and save the PNR.");
  if (shiftedFrom) steps.push(`Open the ticket and confirm the boarding point reads ${c.board}.`);
  const cautions = [];
  if (c.avail && c.avail.kind === "WL") cautions.push("This is a waitlist. If it is still waitlisted at charting, an e-ticket is cancelled and refunded, and you cannot board on it.");
  if (c.avail && ["REGRET", "NA", "DEPARTED", "ERROR", "UNKNOWN"].includes(c.avail.kind)) cautions.push("This option was closed or unreadable when last checked. Re-run the search before trying it.");
  if (shiftedFrom) {
    cautions.push(`You pay the fare from ${c.book_from}, which is more than from ${c.board}.`);
    if (tatkal) cautions.push("Whether a Tatkal ticket allows a boarding-point change is unconfirmed. Check on IRCTC before paying.");
  }
  if (shiftedTo) cautions.push(`You pay the fare to ${c.book_to} and get off early at ${c.alight}. Nothing needs changing on the ticket.`);
  cautions.push("The status above came from an unofficial source. What IRCTC shows at step 3 is what counts.");
  return { fields: fields.map(([label, value, hint]) => ({ label, value, hint })), timing, steps, cautions, checklist: checklist(tatkal), irctc_url: IRCTC_URL };
}

/* ---------- output for the page ---------- */
export function how(o, req) {
  const c = o.legs[0], out = [];
  if (o.kind === "split") {
    const mid = c.book_to;
    return `Two tickets on the same train: ${c.book_from}-${mid} and ${mid}-${o.legs[1].book_to}. Berth may change at ${mid}.`;
  }
  if (c.kind === "earlier-origin" || c.kind === "both-extended") {
    out.push(`Book from ${c.book_from} and set boarding point to ${c.board}`);
    if (c.book_date !== req.on) out.push(`journey date on IRCTC is ${fmtDay(c.book_date, "%d %b")} (when the train leaves ${c.book_from})`);
  }
  if (c.kind === "later-destination" || c.kind === "both-extended") out.push(`Book to ${c.book_to}, get off at ${c.alight}`);
  if (c.kind === "alt-station") out.push(`Get to ${c.board} first`);
  if (c.alight !== req.dest) out.push(`arrives at ${c.alight}`);
  return out.join("; ") || "Book as searched";
}

export function serialize(result, req, demo, now) {
  const options = result.options.map(o => {
    const c = o.legs[0];
    const rank = Math.min(...o.legs.map(l => RANK[l.avail.kind] || 0));
    const probs = o.legs.filter(l => l.avail.kind === "WL" && l.avail.probability !== null).map(l => l.avail.probability);
    const fares = o.legs.map(l => l.avail.fare);
    return {
      id: o.legs.map(l => `${l.train.number} ${l.cls}/${l.quota} ${l.book_from}-${l.book_to} ${fmtDay(l.book_date, "%d%b")}`).join(" + "),
      level: { 3: "available", 2: "rac", 1: "waitlist" }[rank] || "closed",
      kind: o.kind, train: c.train.number, train_name: c.train.name.trim(), depart: c.train.depart, arrive: c.train.arrive, duration: c.train.duration,
      cls: c.cls, quota: c.quota, book_from: c.book_from, book_to: o.legs[o.legs.length - 1].book_to, book_date: c.book_date, board: c.board, alight: c.alight,
      status: o.legs.map(l => l.avail.raw || l.avail.kind).join(" + "),
      chance: probs.length ? Math.min(...probs) : null,
      fare: fares.every(f => f !== null && f !== undefined) ? fares.reduce((x, y) => x + y, 0) : null,
      as_of: o.legs.map(l => l.avail.fetched_at).filter(Boolean).sort()[0] || "",
      score: o.score,
      how: how(o, req),
      sheets: o.legs.map(l => sheetData(l, result.schedules[l.train.number] || null, now)),
    };
  });
  const timelines = {};
  for (const [hit, primary] of result.hits) {
    const stops = result.schedules[hit.number];
    if (!primary || !stops) continue;
    const events = buildTimeline(stops, hit.board, req.on, req.classes.length ? req.classes : hit.classes);
    if (!events) continue;
    const nxt = events.find(e => e.when >= now);
    timelines[hit.number] = events.map(e => ({ when: fmt(e.when, "%a %d %b, %H:%M"), relative: relative(e.when, now), passed: e.when < now, next: e === nxt, label: e.label, note: e.note }));
  }
  const stamps = result.options.flatMap(o => o.legs.map(l => l.avail.fetched_at)).filter(Boolean).sort();
  return {
    origin: req.origin, dest: req.dest, date: req.on, date_label: fmtDay(req.on, "%a %d %b %Y"), demo,
    trains_found: result.trainsFound, checked: result.checked, skipped: result.skipped, notes: result.notes,
    fetched_to: stamps.length ? stamps[stamps.length - 1] : "", options, timelines,
  };
}
