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
const KIND = { "exact": "Direct", "earlier-origin": "Earlier origin", "later-destination": "Later destination", "both-extended": "Extended both ends", "alt-station": "Nearby station", "split": "Two tickets" };
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
  loadAlerts();
  const day = n => { const x = new Date(meta.today + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  $("quick-dates").replaceChildren(...[["Today", 0], ["Tomorrow", 1], ["Day after", 2]].map(([label, n]) =>
    h("button", { type: "button", class: "chip", onclick: () => { d.value = day(n); } }, label)));
  attachSuggest("origin"); attachSuggest("dest");
  renderRecent();
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
    rememberSearch(journey);
    tatkalBanner();
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
    h("button", { type: "button", class: "btn ghost sm", onclick: () => returnTrip() }, "Return trip"),
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
// Sort and filter for the best options, remembered on this device
const prefs = (() => { try { return { sort: "odds", time: "any", cls: "all", ...JSON.parse(localStorage.getItem("railseek.prefs") || "{}") }; } catch (e) { return { sort: "odds", time: "any", cls: "all" }; } })();
const AC = new Set(["1A", "2A", "3A", "3E", "CC", "EC", "EA"]);
const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
function keep(o) {
  const t = mins(o.depart);
  if (prefs.time !== "any" && t !== null) {
    if (prefs.time === "morning" && !(t >= 240 && t < 720)) return false;
    if (prefs.time === "day" && !(t >= 720 && t < 1020)) return false;
    if (prefs.time === "night" && !(t >= 1020 || t < 240)) return false;
  }
  if (prefs.cls === "ac" && !AC.has(o.cls)) return false;
  if (prefs.cls === "nonac" && AC.has(o.cls)) return false;
  return true;
}
// old figures rank a little lower: a waitlist saved two days ago may look very different now
const ageH = o => (o.as_of && !demo ? (Date.now() - new Date(o.as_of).getTime()) / 3600000 : 0);
const fresh = o => o.score - (ageH(o) > 24 ? 15 : ageH(o) > 12 ? 5 : 0);
const SORTS = {
  odds: (a, b) => fresh(b) - fresh(a),
  cheap: (a, b) => (a.fare ?? 1e9) - (b.fare ?? 1e9) || b.score - a.score,
  early: (a, b) => (mins(a.depart) ?? 1e4) - (mins(b.depart) ?? 1e4) || b.score - a.score,
};
function pickBest(all) {
  // filtered and sorted; one row per train and class (its best station pair), at most two per train
  const seen = {}, pairs = new Set(), out = [];
  for (const o of all.filter(keep).sort(SORTS[prefs.sort] || SORTS.odds)) {
    const k = `${o.train}|${o.cls}|${o.quota}`;
    if (pairs.has(k)) continue;
    seen[o.train] = (seen[o.train] || 0) + 1;
    if (seen[o.train] > PER_TRAIN) continue;
    pairs.add(k); out.push(o);
    if (out.length === TOP_N) break;
  }
  return out;
}
let bestState = null;
function bestControls() {
  const sel = (key, label, opts) => h("label", { class: "ctl" }, label, h("select", { "aria-label": label, onchange: e => {
    prefs[key] = e.target.value; try { localStorage.setItem("railseek.prefs", JSON.stringify(prefs)); } catch (err) {}
    if (bestState) renderBest(...bestState);
  } }, opts.map(([v, t]) => h("option", { value: v, selected: prefs[key] === v || null }, t))));
  return h("div", { class: "ctls" },
    sel("sort", "Sort", [["odds", "Best chance"], ["cheap", "Cheapest"], ["early", "Leaves earliest"]]),
    sel("time", "Leaves", [["any", "Any time"], ["morning", "Morning (4 am to noon)"], ["day", "Afternoon (noon to 5 pm)"], ["night", "Evening and night"]]),
    sel("cls", "Class", [["all", "All classes"], ["ac", "AC only"], ["nonac", "Sleeper and seats"]]));
}
function renderBest(all, done, total, failed) {
  bestState = [all, done, total, failed];
  const top = pickBest(all), working = done < total;
  const filtered = prefs.time !== "any" || prefs.cls !== "all";
  const status = working ? `checking trains, ${done} of ${total} done` : failed ? "some trains could not be checked" : `from ${total} train${total === 1 ? "" : "s"}, all classes, ${journey.date <= tomorrowIso() ? "general and Tatkal" : "general quota (Tatkal opens the day before travel)"}`;
  const kids = [h("h2", { class: "h2" }, "Best options", h("small", { role: "status" }, working ? h("span", { class: "spin inline" }) : null, status)), bestControls()];
  if (top.length) kids.push(h("div", { class: "card list" }, top.map((o, i) => optRow(o, i, true))));
  else if (!working && filtered && all.some(o => o.score > 0)) kids.push(h("div", { class: "card empty" }, h("h3", {}, "Nothing matches these filters"), h("div", {}, "There are bookable options at other times or in other classes. Change the filters above.")));
  else if (!working) kids.push(h("div", { class: "card empty" }, h("h3", {}, "Nothing bookable right now"), h("div", {}, "Every class on every train is closed for this date. Try another date, or look again after the first chart is prepared.")));
  else kids.push(h("div", { class: "card empty" }, h("div", {}, "Looking through every train and class.")));
  $("best").replaceChildren(...kids);
}

/* ---------- recent searches, kept on this device ---------- */
function recentList() { try { return JSON.parse(localStorage.getItem("railseek.recent") || "[]"); } catch (e) { return []; } }
function rememberSearch(j) {
  const list = [{ from: j.origin, to: j.dest, quota: j.quota }, ...recentList().filter(r => !(r.from === j.origin && r.to === j.dest))].slice(0, 5);
  try { localStorage.setItem("railseek.recent", JSON.stringify(list)); } catch (e) {}
  renderRecent();
}
function renderRecent() {
  const list = recentList();
  $("recent-row").hidden = !list.length;
  $("recent").replaceChildren(...list.map(r => h("button", { type: "button", class: "chip", title: `Search ${r.from} to ${r.to} again`, onclick: () => {
    $("origin").value = r.from; $("dest").value = r.to; $("quota").value = r.quota || "GN"; showName("origin"); showName("dest"); $("form").requestSubmit();
  } }, `${r.from} → ${r.to}`)));
}

/* ---------- Tatkal countdown for journeys tomorrow ---------- */
const TATKAL_LIST = [
  "Your IRCTC account is Aadhaar-authenticated (My Profile > Authenticate User). Tatkal is refused without it.",
  "The phone linked to your Aadhaar is next to you and has signal, for the booking OTP.",
  "Log in 3 to 5 minutes before opening time. Earlier risks a session timeout; later risks the login queue.",
  "At most 4 passengers per Tatkal booking. A confirmed Tatkal ticket cannot be refunded.",
  "Passengers are saved in My Profile > Master List, with names and ages exactly as on their ID.",
  "Payment is ready: IRCTC eWallet topped up, or a UPI app open on your phone. Avoid cards that need a slow bank OTP.",
];
function tatkalBanner() {
  const nowIst = new Date(Date.now() + 330 * 60000), today = nowIst.toISOString().slice(0, 10), m = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  const plus = n => { const x = new Date(today + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const left = t => { const d = t - m; return d >= 60 ? `in ${Math.floor(d / 60)} h ${d % 60} min` : `in ${d} min`; };
  let text = "";
  if (journey.date === plus(1)) {
    if (m < 600) text = `Tatkal for tomorrow opens today: 10:00 for AC (${left(600)}), 11:00 for sleeper and seats (${left(660)}).`;
    else if (m < 660) text = `Tatkal for AC classes opened at 10:00. Sleeper and seats open at 11:00 (${left(660)}).`;
    else text = "Tatkal for tomorrow opened this morning. Tatkal seats often sell out within minutes, but cancellations reappear.";
  } else if (journey.date === plus(2)) {
    text = "Trains that start their run the day before they reach you open Tatkal a day earlier, so for some trains it opens today. Each train's key moments are in its booking sheet.";
  }
  if (!text) return;
  $("banners").append(h("div", { class: "banner tatkal", role: "status" }, h("span", {}, text),
    h("button", { type: "button", class: "btn ghost sm", onclick: () => openChecklist() }, "Tatkal checklist")));
}
function openChecklist() {
  lastFocus = document.activeElement;
  $("d-title").textContent = "Tatkal checklist"; $("d-sub").textContent = "Get these ready before opening time";
  $("d-body").replaceChildren(h("h3", {}, "Be ready"), h("ul", { class: "plain ready" }, TATKAL_LIST.map(x => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", {}, x))))),
    h("div", { class: "actions" }, h("a", { class: "btn", href: "https://www.irctc.co.in/nget/train-search", target: "_blank", rel: "noopener noreferrer" }, "Open IRCTC")));
  $("drawer").classList.add("on"); $("scrim").classList.add("on"); $("drawer").setAttribute("aria-hidden", "false"); $("d-close").focus();
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

/* ---------- alerts: browser notifications when a watched option changes ---------- */
const pushReady = () => meta && meta.push_key && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - b64.length % 4) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}
async function pushSub(create) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub || !create) return sub;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser's site settings to get alerts.");
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(meta.push_key) });
}
function alertUnsupported() {
  if (meta && !meta.push_key) return "Alerts are not available right now.";
  if (isIOS() && !navigator.standalone) return "On iPhone, alerts work only from the installed app: tap Share, then Add to Home Screen, and open railseek from there.";
  return "This browser cannot show notifications. Try Chrome, Edge, Firefox or Safari.";
}
async function addAlert(o, btn) {
  if (demo) { btn.textContent = "Switch to live data for alerts"; return; }
  if (!pushReady()) { banner("warn", alertUnsupported()); closeDrawer(); return; }
  btn.disabled = true; btn.textContent = "Setting alert";
  try {
    const sub = await pushSub(true);
    await post("/api/alerts/create", { subscription: sub.toJSON(), option: { train: o.train, train_name: o.train_name, cls: o.cls, quota: o.quota,
      book_from: o.book_from, book_to: o.book_to, book_date: o.book_date, board: o.board, origin: journey.origin, dest: journey.dest } });
    btn.textContent = "Alert set";
    loadAlerts();
  } catch (e) {
    btn.disabled = false; btn.textContent = "Alert me";
    banner("err", e.message || "Could not set the alert."); closeDrawer();
  }
}
async function loadAlerts() {
  if (!pushReady()) return;
  let sub;
  try { sub = await pushSub(false); } catch (e) { return; }
  if (!sub) { $("alerts").replaceChildren(); return; }
  let list = [];
  try { list = (await post("/api/alerts/list", { endpoint: sub.endpoint })).alerts; } catch (e) { return; }
  if (!list.length) { $("alerts").replaceChildren(); return; }
  const when = ms => new Date(ms).toLocaleString(window.RS_LOCALE || "en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("alerts").replaceChildren(h("h2", { class: "h2" }, "Your alerts", h("small", {}, "checked about every 30 minutes; notifications come to this browser")),
    h("div", { class: "card list" }, list.map(a => h("div", { class: "alertrow" },
      h("span", {}, h("div", { class: "t1" }, `${a.train} ${a.train_name || ""}`.trim()),
        h("div", { class: "t2" }, `${a.book_from} → ${a.book_to}  ·  ${shortDate(a.book_date)}  ·  ${a.cls}  ·  ${a.quota === "TQ" ? "Tatkal" : "General"}`),
        h("div", { class: "t2" }, [a.tatkal_at ? `Tatkal reminder ${when(a.tatkal_at - 20 * 60000)}` : "", a.chart_at ? `chart reminder ${when(a.chart_at)}` : "", `ends ${when(a.expires)}`].filter(Boolean).join("  ·  "))),
      h("span", { class: "c-status" }, a.label ? h("span", { class: "st " + (["closed", "waitlist", "rac", "available"][a.rank] || "closed") }, a.label) : null),
      h("button", { type: "button", class: "btn ghost sm", onclick: async e => { e.currentTarget.disabled = true; await post("/api/alerts/delete", { endpoint: sub.endpoint, id: a.id }).catch(() => {}); loadAlerts(); } }, "Remove")))),
    h("div", { class: "actions" }, h("button", { type: "button", class: "btn ghost sm", onclick: async e => {
      const b = e.currentTarget; b.disabled = true;
      try { const r = await post("/api/alerts/test", { endpoint: sub.endpoint }); b.textContent = r.result === "sent" ? "Test sent" : "Test could not be sent"; }
      catch (err) { b.textContent = err.message; }
    } }, "Send a test notification")));
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

// "GNWL10/WL2" -> "WL 2" with the waitlist type kept as a small note; "AVAILABLE-0014" -> "14 seats"
function friendly(raw) {
  const one = r => {
    const s = String(r || "").toUpperCase();
    let m;
    if ((m = /(?:AVAILABLE|AVBL|AVL)\D{0,3}0*(\d+)/.exec(s))) return [`${+m[1]} seat${+m[1] === 1 ? "" : "s"}`, ""];
    if ((m = /RAC\s*(\d+)(?:\s*\/\s*RAC\s*(\d+))?/.exec(s))) return [`RAC ${m[2] || m[1]}`, ""];
    if ((m = /\b([A-Z]{0,2}WL)\s*(\d+)(?:\s*\/\s*[A-Z]*WL\s*(\d+))?/.exec(s)) && !s.includes("REGRET")) return [`WL ${m[3] || m[2]}`, m[1] !== "WL" ? m[1] : ""];
    if (s.includes("REGRET")) return ["Regret", ""];
    if (s.includes("NOT AVAILABLE")) return ["N/A", ""];
    return [r, ""];
  };
  const parts = String(raw || "").split(" + ").map(one);
  return [parts.map(p => p[0]).join(" + "), parts.map(p => p[1]).filter(Boolean).join(" + ")];
}
const STALE_MIN = 12 * 60;
const isStale = stamp => stamp && !demo && (Date.now() - new Date(stamp).getTime()) / 60000 > STALE_MIN;
function optRow(o, i, clickable) {
  const [label, wlType] = friendly(o.status);
  const kids = [
    h("span", { class: "rank" }, clickable ? String(i + 1) : ""),
    h("span", {}, h("div", { class: "t1" }, `${o.train} ${o.train_name}`), h("div", { class: "t2" }, [KIND[o.kind] || o.kind, o.depart && o.arrive ? `${o.depart} → ${o.arrive}` : ""].filter(Boolean).join("  ·  "))),
    h("span", { class: "c-book" }, h("div", { class: "pair", title: `${stName(o.book_from)} to ${stName(o.book_to)}` }, o.book_from, h("span", { class: "arrow" }, "→"), o.book_to),
      h("div", { class: "t2" }, `${shortDate(o.book_date)}  ·  ${o.cls}  ·  ${o.quota === "TQ" ? "Tatkal" : "General"}`)),
    h("span", { class: "c-status" }, h("span", { class: "st " + o.level, title: o.status }, label, wlType ? h("small", { class: "wlt" }, wlType) : null),
      h("div", { class: "t2" + (isStale(o.as_of) ? " stale" : "") }, [o.chance !== null ? `${Math.round(o.chance)}% chance` : "", age(o.as_of), isStale(o.as_of) ? "may have changed" : ""].filter(Boolean).join("  ·  "))),
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
async function copyValue(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    // older browsers and some in-app browsers: copy through a hidden text box
    const ta = h("textarea", { "aria-hidden": "true", class: "offscreen" }); ta.value = text; document.body.append(ta); ta.select();
    try { ok = document.execCommand("copy"); } catch (err) {} ta.remove();
  }
  if (ok) { btn.classList.add("done"); setTimeout(() => btn.classList.remove("done"), 1200); }
}
function sheetValue(f) {
  // station fields gain the station's name; codes and numbers can be tapped to copy
  const code = /^(From|To|Boarding)$/.test(f.label) ? f.value : f.label === "Train" ? f.value.split(" ")[0] : f.label === "Class" ? f.value : null;
  const name = /^(From|To|Boarding)$/.test(f.label) && stName(f.value) !== f.value ? stName(f.value) : "";
  const val = code ? h("button", { type: "button", class: "copyval", title: "Copy", "aria-label": `Copy ${code}`, onclick: e => copyValue(code, e.currentTarget) }, f.value) : f.value;
  return [val, name ? h("span", { class: "stnname" }, ` ${name}`) : null];
}
function sheetBlock(s, title = "Enter these on IRCTC") {
  const key = new Set(["From", "To", "Date", "Boarding"]);
  return [
    h("h3", {}, title),
    h("dl", { class: "fields" }, s.fields.map(f => h("div", { class: key.has(f.label) && f.hint ? "key" : "" }, h("dt", {}, f.label),
      h("dd", {}, ...sheetValue(f), f.hint ? h("small", {}, f.hint.replace(/^<-\s*/, "").replace(/^\((.*)\)$/, "$1")) : null)))),
    s.timing.length ? [h("h3", {}, "Timing"), h("ul", { class: "plain" }, s.timing.map(x => h("li", {}, x)))] : null,
    h("h3", {}, "Steps"), h("ol", {}, s.steps.map(x => h("li", {}, x))),
    h("h3", {}, "Before you pay"), h("ul", { class: "caution" }, s.cautions.map(x => h("li", {}, x))),
  ];
}
function openDrawer(o, from) {
  lastFocus = from;
  $("d-title").textContent = `${o.train} ${o.train_name}`.trim();
  $("d-sub").textContent = `${KIND[o.kind] || o.kind}  ·  ${o.cls}  ·  ${o.status}`;
  const s = o.sheets[0];
  const body = o.sheets.length > 1
    ? [h("div", { class: "banner warn" }, `Two separate tickets on the same train. You may have to move to another berth at ${o.sheets[0].fields.find(f => f.label === "To").value}, and each ticket confirms on its own.`),
       ...o.sheets.map((sh, i) => sheetBlock(sh, `Ticket ${i + 1}: enter on IRCTC`))]
    : [sheetBlock(s)];
  body.push(h("div", { id: "d-route" }));
  body.push(h("div", { id: "d-hist" }));
  body.push(h("h3", {}, "Be ready"), h("ul", { class: "plain ready" }, s.checklist.map(x => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", {}, x))))));
  body.push(h("div", { class: "actions" }, h("a", { class: "btn", href: "https://www.irctc.co.in/nget/train-search", target: "_blank", rel: "noopener noreferrer" }, "Open IRCTC"),
    h("button", { class: "btn ghost", type: "button", onclick: e => share(shareText(o), location.href, e.currentTarget) }, "Share"),
    h("button", { class: "btn ghost", type: "button", title: "Notify me when this changes, before Tatkal opens, and at chart time", onclick: e => addAlert(o, e.currentTarget) }, "Alert me"),
    ((last && last.timelines[o.train]) || timelines[o.train]) ? h("button", { class: "btn ghost", type: "button", title: "Tatkal opening, chart time and departure, with reminders", onclick: () => addToCalendar(o) }, "Add to calendar") : null,
    h("button", { class: "btn ghost", type: "button", onclick: e => showRoute(o, e.currentTarget) }, "Route and coaches"),
    h("button", { class: "btn ghost", type: "button", onclick: e => copySheet(o, e.currentTarget) }, "Copy details")));
  const tl = (last && last.timelines[o.train]) || timelines[o.train];
  if (tl) body.push(h("h3", {}, `Key moments, boarding at ${o.board}`), h("ul", { class: "tl" }, tl.map(e => h("li", { class: (e.passed ? "passed " : "") + (e.next ? "next" : "") },
    h("span", { class: "when" }, e.when, h("span", { class: "rel" }, e.relative)), h("span", {}, h("span", { class: "lab" }, e.label), e.note ? h("small", {}, e.note) : null)))));
  $("d-body").replaceChildren(...body.flat(3).filter(Boolean));
  $("d-body").scrollTop = 0;
  $("drawer").classList.add("on"); $("scrim").classList.add("on"); $("drawer").setAttribute("aria-hidden", "false");
  $("d-close").focus();
  const hist = $("d-hist"); if (hist) { hist.dataset.for = o.id; showHistory(o); }
}
/* ---------- the train's whole route, coach order and ratings ---------- */
async function showRoute(o, btn) {
  const box = $("d-route");
  if (!box) return;
  btn.disabled = true;
  box.replaceChildren(h("h3", {}, "Route"), h("p", { class: "t2" }, "Loading the route…"));
  let r;
  try { r = await post("/api/route", { train: o.train, demo }); }
  catch (e) { box.replaceChildren(h("h3", {}, "Route"), h("p", { class: "t2" }, e.message)); btn.disabled = false; return; }
  const mark = { [o.book_from]: "book from", [o.board]: "you board", [o.alight]: "you get off", [o.book_to]: "book to" };
  if (o.board === o.book_from) mark[o.board] = "you board";
  if (o.alight === o.book_to) mark[o.alight] = "you get off";
  const facts = [r.duration ? `${r.duration} h end to end` : "", r.days && r.days.length && r.days.length < 7 ? `runs ${r.days.join(", ")}` : r.days && r.days.length === 7 ? "runs daily" : "",
    r.rating ? `rated ${r.rating}/5 by ConfirmTkt users (on time ${r.punctuality ?? "?"}, clean ${r.cleanliness ?? "?"}, food ${r.food ?? "?"})` : ""].filter(Boolean);
  const inTrip = i => { const b = r.stops.findIndex(s => s.code === o.board), a = r.stops.findIndex(s => s.code === o.alight); return b >= 0 && a >= 0 && i >= b && i <= a; };
  box.replaceChildren(...[h("h3", {}, `Route of ${o.train}`), facts.length ? h("p", { class: "t2" }, facts.join("  ·  ")) : null,
    h("ol", { class: "route" }, r.stops.map((s, i) => h("li", { class: (mark[s.code] ? "mark " : "") + (inTrip(i) ? "trip" : "") },
      h("span", { class: "rt-time" }, s.arr || "start", s.dep && s.arr ? h("small", {}, ` / ${s.dep}`) : !s.arr ? h("small", {}, ` ${s.dep}`) : null),
      h("span", { class: "rt-stn" }, h("b", {}, s.code), ` ${s.name}`, mark[s.code] ? h("em", {}, `  ${mark[s.code]}`) : null),
      h("span", { class: "rt-meta" }, [`day ${s.day}`, s.km !== null && s.km !== undefined ? `${s.km} km` : "", s.platform ? `pf ${s.platform}` : ""].filter(Boolean).join(" · "))))),
    ...(r.coaches && r.coaches.length ? [h("h3", {}, "Coach order"), h("p", { class: "coaches" }, r.coaches.join("  ·  ")),
      h("p", { class: "t2" }, "From the engine end, as published. It can change on the day, so check the coach position board at the station.")] : [])].filter(Boolean));
  btn.textContent = "Route shown below";
}

/* ---------- calendar file with the key moments ---------- */
function addToCalendar(o) {
  const tl = (last && last.timelines[o.train]) || timelines[o.train] || [];
  const ac = AC.has(o.cls), now = Date.now();
  const wanted = e => /^Train leaves|First chart/.test(e.label) || (/^Tatkal opens/.test(e.label) && (ac ? /for AC/.test(e.label) : /non-AC/.test(e.label)));
  const events = tl.filter(e => e.at && e.at > now && wanted(e));
  if (!events.length) { banner("warn", "All of this train's key moments have already passed."); closeDrawer(); return; }
  const z = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = t => String(t).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");   // RFC 5545 text escaping
  const what = `${o.train} ${o.train_name}, ${o.cls}, ${o.book_from} to ${o.book_to}`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//railseek//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  events.forEach((e, i) => {
    const lead = /^Tatkal/.test(e.label) ? 15 : /^Train leaves/.test(e.label) ? 120 : 0;
    lines.push("BEGIN:VEVENT", `UID:${o.train}-${o.book_date}-${i}-${now}@railseek.divkrsh.com`, `DTSTAMP:${z(now)}`, `DTSTART:${z(e.at)}`, `DTEND:${z(e.at + 15 * 60000)}`,
      `SUMMARY:${esc(`${e.label}: ${o.train}`)}`, `DESCRIPTION:${esc(`${what}. ${e.note || ""} Check on IRCTC. ${location.origin}${location.pathname}${location.search}`)}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.label)}`, `TRIGGER:-PT${lead}M`, "END:VALARM", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar" }));
  const a = h("a", { href: url, download: `railseek-${o.train}-${o.book_date}.ics` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- return trip: swap the stations and pick a later date ---------- */
function returnTrip() {
  const a = $("origin").value; $("origin").value = $("dest").value; $("dest").value = a; showName("origin"); showName("dest");
  const d = new Date((journey ? journey.date : meta.today) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 2);
  const iso = d.toISOString().slice(0, 10);
  if (!meta.max_date || iso <= meta.max_date) $("date").value = iso;
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  $("banners").replaceChildren(h("div", { class: "banner warn", role: "status" }, "Stations swapped for the return trip. Pick the return date, then press Find trains."));
  $("date").focus();
}

// how this option's status has moved, from figures saved during earlier searches
async function showHistory(o) {
  if (demo || o.quota !== "GN") return;
  const leg = o.sheets.length > 1 ? null : o;
  if (!leg) return;
  let pts = [];
  try { pts = (await post("/api/history", { train: o.train, book_from: o.book_from, book_to: o.book_to, book_date: o.book_date, cls: o.cls })).points; } catch (e) { return; }
  const box = $("d-hist");
  if (!box || box.dataset.for !== o.id) return;
  const steps = pts.filter((p, i) => i === 0 || p.status !== pts[i - 1].status);
  if (steps.length < 2) {
    box.replaceChildren(h("h3", {}, "Waitlist trend"), h("p", { class: "t2" }, pts.length ? "No change since railseek first saw this option." : "No earlier figures saved yet. They build up as people search."));
    return;
  }
  const when = ms => new Date(ms).toLocaleString(window.RS_LOCALE || "en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const wl = s => { const m = /WL\s*(\d+)\s*$/.exec(s) || /WL(\d+)/.exec(s); return m ? +m[1] : null; };
  const a = wl(steps[0].status), b = wl(steps[steps.length - 1].status);
  const summary = a !== null && b !== null ? (b < a ? `Moving: WL ${a} to WL ${b} since ${when(steps[0].at)}.` : b > a ? `Getting longer: WL ${a} to WL ${b} since ${when(steps[0].at)}.` : "Not moving.") : "";
  box.replaceChildren(h("h3", {}, "Waitlist trend"), summary ? h("p", {}, summary) : null,
    h("ul", { class: "tl" }, steps.slice(-8).map(p => h("li", {}, h("span", { class: "when" }, when(p.at)), h("span", {}, p.status, p.chance ? h("small", {}, `${Math.round(p.chance)}% chance`) : null)))));
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
