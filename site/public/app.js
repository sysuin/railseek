"use strict";
const $ = id => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}
const KIND = { "exact": "Direct", "earlier-origin": "Earlier origin", "later-destination": "Later destination", "both-extended": "Extended both ends", "alt-station": "Nearby station" };
const rupee = n => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
const shortDate = iso => new Date(iso + "T00:00:00").toLocaleDateString(window.RS_LOCALE || "en-IN", { day: "numeric", month: "short" });
function age(stamp) {
  // "saved 3 h ago" for live figures; nothing for demo data
  if (!stamp || demo) return "";
  const mins = Math.round((Date.now() - new Date(stamp).getTime()) / 60000);
  if (!(mins >= 0)) return "";
  if (mins < 60) return `saved ${mins} min ago`;
  if (mins < 48 * 60) return `saved ${Math.round(mins / 60)} h ago`;
  return `saved ${Math.round(mins / 1440)} days ago`;
}
const tomorrowIso = () => { const x = new Date(meta.today + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
let searchId = 0, timelines = {}, lastTrains = null, stations = null;
let meta = null, journey = null, last = null, busy = false, lastFocus = null, demo = true;

/* ---------- data mode ---------- */
function setMode(wantDemo) {
  demo = wantDemo || !meta.live_available;
  $("mode-live").setAttribute("aria-pressed", String(!demo));
  $("mode-demo").setAttribute("aria-pressed", String(demo));
  $("mode-live").disabled = !meta.live_available;
  $("source").className = "badge " + (demo ? "demo" : "live");
  $("source-text").textContent = demo ? "Demo data" : "Live data";
  $("mode-hint").textContent = meta.live_available
    ? (demo ? "Demo shows invented trains. Try SSM to NDLS." : "Live figures are saved copies, not instant lookups. Each result shows when it was saved.")
    : `Live data has reached its limit for ${meta.period === "day" ? "today" : "this month"}, so only demo data is available. Try SSM to NDLS.`;
}
function updateQuota(q) { if (q) { Object.assign(meta, q); setMode(demo); } }

/* ---------- form ---------- */
/* ---------- stations: search by name or code ---------- */
const byCode = () => stations && (byCode.map || (byCode.map = new Map(stations)));
function matches(q) {
  q = q.trim().toUpperCase();
  if (!q || !stations) return [];
  const exact = [], code = [], starts = [], has = [];
  for (const s of stations) {
    const name = s[1].toUpperCase();
    if (s[0] === q) exact.push(s);
    else if (s[0].startsWith(q)) code.push(s);
    else if (name.startsWith(q)) starts.push(s);
    else if (q.length > 2 && name.includes(q)) has.push(s);
    if (starts.length > 30) break;
  }
  return [...exact, ...code, ...starts, ...has].slice(0, 8);
}
function resolveStation(text) {
  // a code, or a name that identifies one station; never guess between several
  const q = text.trim().toUpperCase();
  if (!stations) return q;
  if (byCode().has(q)) return q;
  const named = stations.filter(s => s[1].toUpperCase() === q);
  if (named.length === 1) return named[0][0];
  const m = matches(q);
  if (m.length === 1) return m[0][0];
  return /^[A-Z]{1,6}$/.test(q) ? q : null;   // unknown codes still go through: the list is not complete
}
function showName(id) {
  const code = $(id).value.trim().toUpperCase();
  $(id + "-name").textContent = stations && byCode().has(code) ? byCode().get(code) : "";
}
function attachSuggest(id) {
  const input = $(id), list = $(id + "-list");
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
  const choose = s => { input.value = s[0]; close(); showName(id); };
  const paint = () => {
    list.replaceChildren(...items.map((s, i) => h("li", { role: "option", id: `${id}-opt-${i}`, "aria-selected": String(i === active), class: i === active ? "on" : "",
      onmousedown: e => { e.preventDefault(); choose(s); } }, h("b", {}, s[0]), h("span", {}, s[1]))));
    list.hidden = !items.length; input.setAttribute("aria-expanded", String(!!items.length));
    if (active >= 0) input.setAttribute("aria-activedescendant", `${id}-opt-${active}`); else input.removeAttribute("aria-activedescendant");
  };
  input.addEventListener("input", () => { items = matches(input.value); active = -1; paint(); showName(id); });
  input.addEventListener("keydown", e => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { active = (active + 1) % items.length; paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + items.length) % items.length; paint(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { choose(items[active]); e.preventDefault(); }
    else if (e.key === "Escape") { close(); e.stopPropagation(); }
  });
  input.addEventListener("blur", () => { close(); showName(id); });
}
async function loadStations() {
  try { stations = await (await fetch("/stations.json")).json(); showName("origin"); showName("dest"); } catch (e) { stations = null; }
}

function save() { try { localStorage.setItem("railseek.site", JSON.stringify({ origin: $("origin").value, dest: $("dest").value, quota: $("quota").value, pax: $("pax").value })); } catch (e) {} }
const pax = () => Math.max(1, Math.min(6, parseInt($("pax").value, 10) || 1));
function fareCell(fare) {
  // per-person fare from the source, shown as the total for the group
  if (fare === null || fare === undefined) return "";
  const n = pax();
  return n === 1 ? rupee(fare) : [rupee(fare * n), h("small", {}, `${rupee(fare)} × ${n}`)];
}
async function init() {
  meta = await (await fetch("/api/meta")).json();
  const d = $("date"); d.min = meta.today; d.max = meta.max_date;
  const t = new Date(meta.today + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  d.value = t.toISOString().slice(0, 10);
  try { const s = JSON.parse(localStorage.getItem("railseek.site") || "null"); if (s) { $("origin").value = s.origin || ""; $("dest").value = s.dest || ""; $("quota").value = s.quota || "GN"; $("pax").value = s.pax || "1"; } } catch (e) {}
  setMode(!meta.live_available);
  const day = n => { const x = new Date(meta.today + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  $("quick-dates").replaceChildren(...[["Today", 0], ["Tomorrow", 1], ["Day after", 2]].map(([label, n]) =>
    h("button", { type: "button", class: "chip", onclick: () => { d.value = day(n); } }, label)));
  attachSuggest("origin"); attachSuggest("dest");
  const stationsReady = loadStations();
  // a shared link fills the form and runs the search
  const p = new URLSearchParams(location.search), code = /^[A-Za-z]{1,6}$/;
  if (code.test(p.get("from") || "") && code.test(p.get("to") || "")) {
    $("origin").value = p.get("from").toUpperCase(); $("dest").value = p.get("to").toUpperCase();
    const on = p.get("date") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(on) && on >= meta.today && on <= meta.max_date) d.value = on;
    if (p.get("quota") === "TQ" || p.get("quota") === "GN") $("quota").value = p.get("quota");
    await stationsReady;
    $("form").requestSubmit();
  }
}
$("mode-live").addEventListener("click", () => setMode(false));
$("mode-demo").addEventListener("click", () => setMode(true));
$("swap").addEventListener("click", () => { const a = $("origin").value; $("origin").value = $("dest").value; $("dest").value = a; showName("origin"); showName("dest"); });
$("quota").addEventListener("change", () => { if (journey && lastTrains) { journey.quota = $("quota").value; renderTrains(lastTrains);
  try { history.replaceState(null, "", "?" + new URLSearchParams({ from: journey.origin, to: journey.dest, date: journey.date, quota: journey.quota })); } catch (e) {} $("out").replaceChildren(); last = null; } });

function banner(kind, text) { $("banners").append(h("div", { class: "banner " + kind, role: kind === "err" ? "alert" : "status" }, text)); }
async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || "The request failed. Please try again.");
  return data;
}

/* ---------- step 1: trains ---------- */
$("form").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  $("banners").replaceChildren();
  for (const id of ["origin", "dest"]) { $(id + "-list").hidden = true; $(id).setAttribute("aria-expanded", "false"); }
  const from = resolveStation($("origin").value), to = resolveStation($("dest").value);
  if (!from || !to) { banner("err", `Pick ${!from ? "the From" : "the To"} station from the list, or type its station code.`); return; }
  $("origin").value = from; $("dest").value = to; showName("origin"); showName("dest");
  busy = true; save();
  const go = $("go"); go.disabled = true; go.replaceChildren(h("span", { class: "spin" }), "Finding");
  const id = ++searchId; for (const s of ["best", "dates", "conn", "nearby"]) $(s).replaceChildren();
  journey = { origin: from, dest: to, date: $("date").value, quota: $("quota").value, demo };
  try {
    const data = await post("/api/trains", journey);
    updateQuota(data.quota);
    last = null; $("out").replaceChildren();
    lastTrains = data;
    try { history.replaceState(null, "", "?" + new URLSearchParams({ from, to, date: journey.date, quota: journey.quota })); } catch (e) {}
    renderTrains(data);
    findBest(data).then(() => { if (id === searchId) findConnections(id); });
    findDates(id);
    findNearby(id);
    groupNotes();
  } catch (err) {
    banner("err", err.message); refreshMeta();
  } finally { busy = false; go.disabled = false; go.textContent = "Find trains"; }
});
async function refreshMeta() { try { updateQuota(await (await fetch("/api/meta")).json()); } catch (e) {} }

function renderTrains(d) {
  const box = [];
  box.push(h("div", { class: "summary" }, h("h2", {}, `${d.origin} → ${d.dest}`),
    h("button", { type: "button", class: "btn ghost sm", onclick: e => share(`Train options ${d.origin} to ${d.dest} on ${d.date}`, location.href, e.currentTarget) }, "Share search"),
    h("span", { class: "meta" }, new Date(d.date + "T00:00:00").toLocaleDateString(window.RS_LOCALE || "en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
    h("span", { class: "meta" }, `${d.trains.length} train${d.trains.length === 1 ? "" : "s"}`)));
  if (d.demo) box.push(h("div", { class: "banner demo" }, "Demo data: these trains, timings and statuses are invented."));
  if (!d.trains.length) box.push(h("div", { class: "card empty mt" }, h("h3", {}, "No trains found for this route and date"),
    h("div", {}, d.demo ? "Demo data only knows a few stations. Try SSM to NDLS, SSM to DLI or GAYA to CNB." : "Check the station codes, or try a nearby station.")));
  else {
    const tatkal = journey.quota === "TQ";
    box.push(h("div", { class: "hint hintrow" }, `All trains on this route with ${tatkal ? "Tatkal" : "general"}-quota status for your stations. Tap a class to check other station pairs on that train, even when it shows Regret.`));
    box.push(h("div", { class: "card list" }, d.trains.map(t => {
      const sub = [t.depart && t.arrive ? `${t.depart} → ${t.arrive}` : "", t.duration ? t.duration + " h" : "", `${t.board} → ${t.alight}`].filter(Boolean).join("  ·  ");
      return h("div", { class: "train" },
        h("div", {}, h("div", { class: "t1" }, `${t.number} ${t.name.trim()}`), h("div", { class: "t2" }, sub)),
        h("div", { class: "cls" }, t.classes.map(c => {
          const s = ((t.status || {})[journey.quota] || {})[c];
          const tip = s ? [s.raw, s.chance !== null && s.chance !== undefined ? `${Math.round(s.chance)}% chance` : "", age(s.as_of)].filter(Boolean).join(" · ") : "";
          return h("button", { type: "button", class: "chip" + (s ? " " + s.level : ""), "data-train": t.number, "data-cls": c, title: tip || null,
            "aria-label": `Check ${c} on ${t.number}` + (s ? `, currently ${s.label}` : ""), onclick: e => check(t, c, e.currentTarget) }, h("b", {}, c), s ? h("span", {}, s.label) : null);
        })));
    })));
    box.push(h("details", { class: "legend" }, h("summary", {}, "What the colours and codes mean"), h("ul", {},
      h("li", {}, h("span", { class: "st available" }, "12 seats"), " Confirmed berths are on sale."),
      h("li", {}, h("span", { class: "st rac" }, "RAC 5"), " You can board and share a side berth; it usually becomes a full berth."),
      h("li", {}, h("span", { class: "st waitlist" }, "WL 8"), " Waitlisted. You may travel only if it confirms or reaches RAC before the chart."),
      h("li", {}, h("span", { class: "st closed" }, "Regret"), " Booking is closed for this station pair. Another pair on the same train may still be open."),
      h("li", {}, h("span", { class: "st closed" }, "N/A"), " Not on sale for this pair right now, for example Tatkal before it opens or after it sells out."),
      h("li", {}, h("b", {}, "GNWL"), " is the general waitlist from the train's starting stations and clears most often. ", h("b", {}, "RLWL"), " and ", h("b", {}, "PQWL"),
        " are smaller waitlists for stations along the route. ", h("b", {}, "TQWL"), " is the Tatkal waitlist and clears least often."))));
  }
  $("trains").replaceChildren(...box);
}

/* ---------- best options: sweep every train in small batches, keep the top 5 ---------- */
const TOP_N = 5, BATCH = 3, PER_TRAIN = 2;
function pickBest(all) {
  // best first, at most two per train so one train's classes do not fill the list
  const seen = {}, out = [];
  for (const o of [...all].sort((a, b) => b.score - a.score)) {
    seen[o.train] = (seen[o.train] || 0) + 1;
    if (seen[o.train] <= PER_TRAIN) out.push(o);
    if (out.length === TOP_N) break;
  }
  return out;
}
function renderBest(all, done, total, failed) {
  const top = pickBest(all), working = done < total;
  const status = working ? `checking trains, ${done} of ${total} done` : failed ? "some trains could not be checked" : `from ${total} train${total === 1 ? "" : "s"}, all classes, ${journey.date <= tomorrowIso() ? "general and Tatkal" : "general quota (Tatkal opens the day before travel)"}`;
  const kids = [h("h2", { class: "h2" }, "Best options", h("small", { role: "status" }, working ? h("span", { class: "spin inline" }) : null, status))];
  if (top.length) kids.push(h("div", { class: "card list" }, top.map((o, i) => optRow(o, i, true))));
  else if (!working) kids.push(h("div", { class: "card empty" }, h("h3", {}, "Nothing bookable right now"), h("div", {}, "Every class on every train is closed for this date. Try another date, or look again after the first chart is prepared.")));
  else kids.push(h("div", { class: "card empty" }, h("div", {}, "Looking through every train and class.")));
  $("best").replaceChildren(...kids);
}
/* ---------- offline: keep the last search to show without a connection ---------- */
function keepLast(best) {
  try { localStorage.setItem("railseek.last", JSON.stringify({ journey, trains: lastTrains, best, saved: Date.now() })); } catch (e) {}
}
function showLast() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem("railseek.last") || "null"); } catch (e) {}
  if (!s || !s.trains) { banner("err", "You are offline and there is no saved search to show."); return; }
  journey = s.journey; lastTrains = s.trains;
  $("origin").value = journey.origin; $("dest").value = journey.dest; $("date").value = journey.date;
  const when = new Date(s.saved).toLocaleString(window.RS_LOCALE || "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  banner("warn", `You are offline. This is your last search, saved ${when}. Figures will have changed since.`);
  renderTrains(s.trains);
  if (s.best && s.best.length) $("best").replaceChildren(h("h2", { class: "h2" }, "Best options", h("small", {}, `saved ${when}`)), h("div", { class: "card list" }, s.best.map((o, i) => optRow(o, i, true))));
}

async function findBest(d) {
  const id = searchId, all = [];
  timelines = {};
  $("best").replaceChildren();
  const numbers = d.trains.map(t => t.number);
  if (!numbers.length) return;
  let done = 0, failed = false;
  renderBest(all, 0, numbers.length, false);
  for (let i = 0; i < numbers.length; i += BATCH) {
    const batch = numbers.slice(i, i + BATCH);
    try {
      const data = await post("/api/top", { ...journey, trains: batch });
      if (id !== searchId) return;            // a newer search has started
      updateQuota(data.quota);
      Object.assign(timelines, data.timelines);
      all.push(...data.options);
    } catch (err) {
      if (id !== searchId) return;
      failed = true;
      if (!all.length && i === 0) { $("best").replaceChildren(); banner("err", err.message); refreshMeta(); return; }
    }
    done += batch.length;
    renderBest(all, done, numbers.length, failed);
    if (done >= numbers.length && !demo) keepLast(pickBest(all));
  }
}

/* ---------- sharing: the phone's share sheet, else WhatsApp ---------- */
function shareText(o) {
  const q = o.quota === "TQ" ? "Tatkal" : "General";
  const board = o.board !== o.book_from ? `, board at ${o.board}` : "";
  return `Train ${o.train} ${o.train_name}: book ${o.book_from} to ${o.book_to} on ${shortDate(o.book_date)}, ${o.cls}, ${q} quota${board}. Status ${o.status}` +
    (o.chance !== null ? ` (${Math.round(o.chance)}% chance)` : "") + ". Check on IRCTC before paying.";
}
async function share(text, url, btn) {
  if (navigator.share) {
    try { await navigator.share({ title: "railseek", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  window.open("https://wa.me/?text=" + encodeURIComponent(`${text}\n${url}`), "_blank", "noopener");
  if (btn) { const old = btn.textContent; btn.textContent = "Opened WhatsApp"; setTimeout(() => btn.textContent = old, 1600); }
}

/* ---------- group size notes ---------- */
function groupNotes() {
  const n = pax();
  if (n > 4 && journey.quota === "TQ") banner("warn", "A Tatkal ticket can carry at most 4 passengers. For a larger group you need two bookings, and they may not get berths together.");
  else if (n > 1) banner("warn", `Fares are shown for ${n} passengers. On a waitlist, every passenger on one ticket has to confirm, so a large group confirms less often than one person.`);
}
$("pax").addEventListener("change", () => { save(); if (lastTrains) $("form").requestSubmit(); });

/* ---------- start from a nearby station ---------- */
async function findNearby(id) {
  try {
    const d = await post("/api/nearby", journey);
    if (id !== searchId) return;
    updateQuota(d.quota);
    if (!d.stations.length || !d.options.length) return;
    const kids = [h("h2", { class: "h2" }, "Start from a nearby station",
      h("small", {}, d.stations.map(s => `${stName(s.code)} ${s.km} km`).join(", ") + ", straight-line distance"))];
    kids.push(h("div", { class: "card list" }, d.options.map(o => h("button", { type: "button", class: "near", title: `Search from ${stName(o.station)}`,
      onclick: () => { $("origin").value = o.station; showName("origin"); $("form").requestSubmit(); window.scrollTo({ top: 0 }); } },
      h("span", {}, h("div", { class: "t1" }, `${o.train} ${o.train_name}`), h("div", { class: "t2" }, `from ${stName(o.station)} (${o.station}), about ${o.km} km away`)),
      h("span", { class: "c-mid" }, h("div", { class: "pair" }, o.board, h("span", { class: "arrow" }, "→"), o.alight),
        h("div", { class: "t2" }, `${o.depart} → ${o.arrive}  ·  ${o.cls}  ·  ${o.quota === "TQ" ? "Tatkal" : "General"}`)),
      h("span", { class: "c-status" }, h("span", { class: "st " + o.level }, o.label),
        h("div", { class: "t2" }, [o.chance !== null && o.chance !== undefined ? `${Math.round(o.chance)}% chance` : "", o.fare ? rupee(o.fare * pax()) : ""].filter(Boolean).join("  ·  ")))))));
    kids.push(h("p", { class: "hint" }, "Trains that do not stop at your station. Tap one to search from that station. Allow time to get there; road distance is longer than shown."));
    d.notes.forEach(n => kids.push(h("div", { class: "banner warn" }, n)));
    $("nearby").replaceChildren(...kids);
  } catch (e) { /* extra; the main search already worked */ }
}

/* ---------- flexible dates: the best option on nearby days ---------- */
const stName = code => (stations && byCode().get(code)) || code;
const dayLabel = iso => new Date(iso + "T00:00:00").toLocaleDateString(window.RS_LOCALE || "en-IN", { weekday: "short", day: "numeric", month: "short" });
async function findDates(id) {
  try {
    const d = await post("/api/dates", journey);
    if (id !== searchId) return;
    updateQuota(d.quota);
    if (d.days.length < 2) return;
    $("dates").replaceChildren(h("h2", { class: "h2" }, "Nearby dates", h("small", {}, "best option each day for your stations")),
      h("div", { class: "days" }, d.days.map(day => {
        const b = day.best;
        const body = day.error ? [h("span", { class: "t2" }, "could not check")]
          : b ? [h("span", { class: "st " + b.level }, b.label), h("span", { class: "t2" }, `${b.cls} · ${b.train}${b.chance !== null ? ` · ${Math.round(b.chance)}%` : ""}`)]
          : [h("span", { class: "st closed" }, day.trains ? "All closed" : "No trains")];
        return h("button", { type: "button", class: "day" + (day.selected ? " on" : ""), "aria-pressed": String(day.selected), disabled: day.selected || null,
          title: b ? `${b.train} ${b.train_name}, ${b.raw}` : null,
          onclick: () => { $("date").value = day.date; $("form").requestSubmit(); } },
          h("b", {}, dayLabel(day.date)), ...body, h("span", { class: "t2" }, `${day.open} of ${day.trains} trains bookable`));
      })));
  } catch (e) { /* nearby dates are extra; the main search already worked */ }
}

/* ---------- connecting journeys through a hub ---------- */
const hhmm = min => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
function legLine(l, n) {
  return h("div", { class: "leg" }, h("span", { class: "legn" }, String(n)),
    h("span", {}, h("div", { class: "t1" }, `${l.train} ${l.train_name}`),
      h("div", { class: "t2" }, `${l.from} ${l.depart} → ${l.to} ${l.arrive}  ·  ${shortDate(l.date)}  ·  ${l.cls}  ·  ${l.quota === "TQ" ? "Tatkal" : "General"}`)),
    h("span", { class: "c-status" }, h("span", { class: "st " + l.level }, l.label),
      h("div", { class: "t2" }, [l.chance !== null && l.chance !== undefined ? `${Math.round(l.chance)}% chance` : "", age(l.as_of)].filter(Boolean).join("  ·  "))));
}
async function findConnections(id) {
  try {
    const d = await post("/api/connections", journey);
    if (id !== searchId) return;
    updateQuota(d.quota);
    if (!d.hubs.length) return;
    const hubs = d.hubs.map(c => `${stName(c)} (${c})`).join(" or ");
    const kids = [h("h2", { class: "h2" }, "Change trains", h("small", {}, `via ${hubs}`))];
    if (!d.connections.length) kids.push(h("div", { class: "card empty" }, h("div", {}, `No bookable two-train journey via ${hubs} with a 1 to 8 hour wait.`)));
    else {
      kids.push(h("div", { class: "card list" }, d.connections.map(c => h("div", { class: "conn" },
        h("div", { class: "connhead" }, h("b", {}, `Change at ${stName(c.hub)}`),
          h("span", { class: "t2" }, `${hhmm(c.gap)} wait${c.tight ? " (tight)" : ""}  ·  ${hhmm(c.total_min)} in all`
            + (c.legs.every(l => l.fare) ? `  ·  ${rupee((c.legs[0].fare + c.legs[1].fare) * pax())}${pax() > 1 ? ` for ${pax()}` : ""}` : ""))),
        legLine(c.legs[0], 1), legLine(c.legs[1], 2),
        h("div", { class: "actions" }, h("button", { type: "button", class: "btn ghost", onclick: e => copyConn(c, e.currentTarget) }, "Copy both tickets"))))));
      kids.push(h("p", { class: "hint" }, "These are two separate tickets. If the first train runs late you can miss the second, and the second ticket is not refunded for that. Leave a longer wait where you can."));
    }
    d.notes.forEach(n => kids.push(h("div", { class: "banner warn" }, n)));
    $("conn").replaceChildren(...kids);
  } catch (e) { /* connections are extra */ }
}
async function copyConn(c, btn) {
  const text = c.legs.map((l, i) => `Ticket ${i + 1}: train ${l.train}, ${l.from} to ${l.to}, ${l.date}, class ${l.cls}, quota ${l.quota}`).join("\n");
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch (e) { btn.textContent = "Copy failed"; }
  setTimeout(() => btn.textContent = "Copy both tickets", 1600);
}

/* ---------- step 2: check one train and class ---------- */
async function check(t, cls, btn) {
  if (busy) return;
  busy = true; $("banners").replaceChildren();
  document.querySelectorAll(".train .chip").forEach(c => { c.classList.remove("on"); c.disabled = true; });
  btn.classList.add("on");
  $("out").replaceChildren(h("div", { class: "card empty mt" }, h("h3", {}, `Checking ${t.number} in ${cls}`), h("div", {}, "Looking at your station pair and others on the same train.")));
  try {
    const data = await post("/api/check", { ...journey, train: t.number, cls });
    updateQuota(data.quota);
    last = data; renderResults(data, t, cls);
    $("out").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (err) {
    $("out").replaceChildren(); banner("err", err.message); refreshMeta();
  } finally {
    busy = false; document.querySelectorAll(".train .chip").forEach(c => c.disabled = false);
  }
}

function optRow(o, i, clickable) {
  const kids = [
    h("span", { class: "rank" }, clickable ? String(i + 1) : ""),
    h("span", {}, h("div", { class: "t1" }, `${o.train} ${o.train_name}`), h("div", { class: "t2" }, [KIND[o.kind] || o.kind, o.depart && o.arrive ? `${o.depart} → ${o.arrive}` : ""].filter(Boolean).join("  ·  "))),
    h("span", { class: "c-book" }, h("div", { class: "pair" }, o.book_from, h("span", { class: "arrow" }, "→"), o.book_to),
      h("div", { class: "t2" }, `${shortDate(o.book_date)}  ·  ${o.cls}  ·  ${o.quota === "TQ" ? "Tatkal" : "General"}`)),
    h("span", { class: "c-status" }, h("span", { class: "st " + o.level }, o.status),
      h("div", { class: "t2" }, [o.chance !== null ? `${Math.round(o.chance)}% chance` : "", age(o.as_of)].filter(Boolean).join("  ·  "))),
    h("span", { class: "fare" }, fareCell(o.fare)),
    h("span", { class: "chev", "aria-hidden": "true" }, clickable ? "›" : ""),
    clickable ? h("span", { class: "how" }, o.how) : null,
  ];
  return clickable ? h("button", { class: "opt", type: "button", onclick: e => openDrawer(o, e.currentTarget) }, kids) : h("div", { class: "opt" }, kids);
}
function renderResults(d, t, cls) {
  const open = d.options.filter(o => o.level !== "closed"), closed = d.options.filter(o => o.level === "closed");
  const time = d.fetched_to ? d.fetched_to.slice(11, 16) : "";
  const out = [h("h2", { class: "h2" }, `${t.number} ${t.name.trim()} in ${cls}`, h("small", {}, `${d.checked} checks` + (d.skipped ? `, ${d.skipped} not made` : "") + (time ? `, as of ${time} IST` : "")))];
  d.notes.forEach(n => out.push(h("div", { class: "banner warn" }, n)));
  if (open.length) out.push(h("div", { class: "card list" }, open.map((o, i) => optRow(o, i, true))));
  else out.push(h("div", { class: "card empty" }, h("h3", {}, "Nothing bookable on this train in this class"), h("div", {}, "Try another class or train, or look again after the first chart is prepared.")));
  if (closed.length) out.push(h("details", { class: "closed" }, h("summary", {}, `${closed.length} checked combination${closed.length === 1 ? " is" : "s are"} closed`),
    h("div", { class: "card list" }, closed.map(o => optRow(o, 0, false)))));
  $("out").replaceChildren(...out);
}

/* ---------- drawer ---------- */
function sheetBlock(s) {
  const key = new Set(["From", "To", "Date", "Boarding"]);
  return [
    h("h3", {}, "Enter these on IRCTC"),
    h("dl", { class: "fields" }, s.fields.map(f => h("div", { class: key.has(f.label) && f.hint ? "key" : "" }, h("dt", {}, f.label),
      h("dd", {}, f.value, f.hint ? h("small", {}, f.hint.replace(/^<-\s*/, "").replace(/^\((.*)\)$/, "$1")) : null)))),
    s.timing.length ? [h("h3", {}, "Timing"), h("ul", { class: "plain" }, s.timing.map(x => h("li", {}, x)))] : null,
    h("h3", {}, "Steps"), h("ol", {}, s.steps.map(x => h("li", {}, x))),
    h("h3", {}, "Before you pay"), h("ul", { class: "caution" }, s.cautions.map(x => h("li", {}, x))),
  ];
}
function openDrawer(o, from) {
  lastFocus = from;
  $("d-title").textContent = `${o.train} ${o.train_name}`.trim();
  $("d-sub").textContent = `${KIND[o.kind] || o.kind}  ·  ${o.cls}  ·  ${o.status}`;
  const s = o.sheets[0], body = [sheetBlock(s)];
  body.push(h("h3", {}, "Be ready"), h("ul", { class: "plain ready" }, s.checklist.map(x => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", {}, x))))));
  body.push(h("div", { class: "actions" }, h("a", { class: "btn", href: "https://www.irctc.co.in/nget/train-search", target: "_blank", rel: "noopener noreferrer" }, "Open IRCTC"),
    h("button", { class: "btn ghost", type: "button", onclick: e => share(shareText(o), location.href, e.currentTarget) }, "Share"),
    h("button", { class: "btn ghost", type: "button", onclick: e => copySheet(o, e.currentTarget) }, "Copy details")));
  const tl = (last && last.timelines[o.train]) || timelines[o.train];
  if (tl) body.push(h("h3", {}, `Key moments, boarding at ${o.board}`), h("ul", { class: "tl" }, tl.map(e => h("li", { class: (e.passed ? "passed " : "") + (e.next ? "next" : "") },
    h("span", { class: "when" }, e.when, h("span", { class: "rel" }, e.relative)), h("span", {}, h("span", { class: "lab" }, e.label), e.note ? h("small", {}, e.note) : null)))));
  $("d-body").replaceChildren(...body.flat(3).filter(Boolean));
  $("d-body").scrollTop = 0;
  $("drawer").classList.add("on"); $("scrim").classList.add("on"); $("drawer").setAttribute("aria-hidden", "false");
  $("d-close").focus();
}
function closeDrawer() {
  $("drawer").classList.remove("on"); $("scrim").classList.remove("on"); $("drawer").setAttribute("aria-hidden", "true");
  if (lastFocus) lastFocus.focus();
}
async function copySheet(o, btn) {
  const text = o.sheets.map(s => s.fields.map(f => `${f.label}: ${f.value}`).join("\n")).join("\n\n");
  try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; } catch (e) { btn.textContent = "Copy failed"; }
  setTimeout(() => btn.textContent = "Copy details", 1600);
}
$("d-close").addEventListener("click", closeDrawer);
$("scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("drawer").classList.contains("on")) closeDrawer(); });

init().catch(() => {
  meta = meta || { today: new Date().toISOString().slice(0, 10), max_date: "", live_available: false, period: "day" };
  showLast();
});
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
