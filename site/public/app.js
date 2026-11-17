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
const shortDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
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
    ? (demo ? "Demo shows invented trains. Try SSM to NDLS." : `Live data is shared and limited: ${meta.remaining} of ${meta.monthly_cap} requests left this month. One check uses up to 8.`)
    : "This month's live data allowance is used up, so only demo data is available. Try SSM to NDLS.";
}
function updateQuota(q) { if (q) { Object.assign(meta, q); setMode(demo); } }

/* ---------- form ---------- */
function save() { try { localStorage.setItem("railseek.site", JSON.stringify({ origin: $("origin").value, dest: $("dest").value, quota: $("quota").value })); } catch (e) {} }
async function init() {
  meta = await (await fetch("/api/meta")).json();
  const d = $("date"); d.min = meta.today; d.max = meta.max_date;
  const t = new Date(meta.today + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  d.value = t.toISOString().slice(0, 10);
  try { const s = JSON.parse(localStorage.getItem("railseek.site") || "null"); if (s) { $("origin").value = s.origin || ""; $("dest").value = s.dest || ""; $("quota").value = s.quota || "GN"; } } catch (e) {}
  setMode(!meta.live_available);
}
$("mode-live").addEventListener("click", () => setMode(false));
$("mode-demo").addEventListener("click", () => setMode(true));
$("swap").addEventListener("click", () => { const a = $("origin").value; $("origin").value = $("dest").value; $("dest").value = a; });

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
  busy = true; $("banners").replaceChildren(); save();
  const go = $("go"); go.disabled = true; go.replaceChildren(h("span", { class: "spin" }), "Finding");
  journey = { origin: $("origin").value.trim().toUpperCase(), dest: $("dest").value.trim().toUpperCase(), date: $("date").value, quota: $("quota").value, demo };
  try {
    const data = await post("/api/trains", journey);
    updateQuota(data.quota);
    last = null; $("out").replaceChildren();
    renderTrains(data);
  } catch (err) {
    banner("err", err.message); refreshMeta();
  } finally { busy = false; go.disabled = false; go.textContent = "Find trains"; }
});
async function refreshMeta() { try { updateQuota(await (await fetch("/api/meta")).json()); } catch (e) {} }

function renderTrains(d) {
  const box = [];
  box.push(h("div", { class: "summary" }, h("h2", {}, `${d.origin} → ${d.dest}`),
    h("span", { class: "meta" }, new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
    h("span", { class: "meta" }, `${d.trains.length} train${d.trains.length === 1 ? "" : "s"}`)));
  if (d.demo) box.push(h("div", { class: "banner demo" }, "Demo data: these trains, timings and statuses are invented."));
  if (!d.trains.length) box.push(h("div", { class: "card empty mt" }, h("h3", {}, "No trains found for this route and date"),
    h("div", {}, d.demo ? "Demo data only knows a few stations. Try SSM to NDLS, SSM to DLI or GAYA to CNB." : "Check the station codes, or try a nearby station.")));
  else {
    box.push(h("div", { class: "hint hintrow" }, "Tap a class to check that train's station pairs."));
    box.push(h("div", { class: "card list" }, d.trains.map(t => {
      const sub = [t.depart && t.arrive ? `${t.depart} → ${t.arrive}` : "", t.duration ? t.duration + " h" : "", `${t.board} → ${t.alight}`].filter(Boolean).join("  ·  ");
      return h("div", { class: "train" },
        h("div", {}, h("div", { class: "t1" }, `${t.number} ${t.name.trim()}`), h("div", { class: "t2" }, sub)),
        h("div", { class: "cls" }, t.classes.map(c => h("button", { type: "button", class: "chip", "data-train": t.number, "data-cls": c, "aria-label": `Check ${c} on ${t.number}`, onclick: e => check(t, c, e.currentTarget) }, c))));
    })));
  }
  $("trains").replaceChildren(...box);
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
    h("span", {}, h("div", { class: "t1" }, KIND[o.kind] || o.kind), h("div", { class: "t2" }, `${o.train} ${o.train_name}`)),
    h("span", { class: "c-book" }, h("div", { class: "pair" }, o.book_from, h("span", { class: "arrow" }, "→"), o.book_to),
      h("div", { class: "t2" }, `${shortDate(o.book_date)}  ·  ${o.cls}  ·  ${o.quota}`)),
    h("span", { class: "c-status" }, h("span", { class: "st " + o.level }, o.status), o.chance !== null ? h("div", { class: "t2" }, `${Math.round(o.chance)}% chance`) : null),
    h("span", { class: "fare" }, o.fare !== null ? rupee(o.fare) : ""),
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
    h("button", { class: "btn ghost", type: "button", onclick: e => copySheet(o, e.currentTarget) }, "Copy details")));
  const tl = last && last.timelines[o.train];
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

init().catch(() => banner("err", "Could not load the site. Please refresh."));
