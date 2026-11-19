// Alerts: watch one train, class and quota for a station pair and date, and send a browser
// notification when its status changes, shortly before Tatkal opens, and at chart time.
// Stored in D1 (free: 100,000 writes a day), checked by a timer Worker every 15 minutes.

import { AC_CLASSES, ALL_CLASSES, ProviderError, addDays, brief, buildTimeline, fmt, fmtDay, istToday } from "./core.js";
import { sendPush, validEndpoint } from "./push.js";

const CODE = /^[A-Z]{1,6}$/, TRAIN = /^[0-9A-Z]{3,6}$/;
const RANK = { available: 3, rac: 2, waitlist: 1, closed: 0 };
const CHECK_EVERY = 30 * 60000;          // each alert's status is looked at about every 30 minutes
const MAX_GROUPS_PER_RUN = 5;            // station pairs per call: keeps a call inside the 50-subrequest limit
const MAX_PUSHES_PER_RUN = 15;
export class AlertError extends Error {}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const subId = async endpoint => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint))).slice(0, 32);
const searchUrl = a => `/?${new URLSearchParams({ from: a.origin, to: a.dest, date: a.book_date, quota: a.quota })}`;
const what = a => `${a.train} ${a.cls}${a.quota === "TQ" ? " Tatkal" : ""}, ${a.book_from} to ${a.book_to} on ${fmtDay(a.book_date, "%d %b")}`;

function view(a, now) {
  return { id: a.id, train: a.train, train_name: a.train_name, cls: a.cls, quota: a.quota, book_from: a.book_from, book_to: a.book_to,
    book_date: a.book_date, board: a.board, origin: a.origin, dest: a.dest, label: a.label, rank: a.rank,
    tatkal_at: a.tatkal_sent ? null : a.tatkal_at, chart_at: a.chart_sent ? null : a.chart_at, expires: a.expires, checked: a.checked || null,
    expires_label: fmt(a.expires, "%a %d %b, %H:%M"), now };
}

async function subFor(db, endpoint, env) {
  if (!validEndpoint(endpoint, env)) throw new AlertError("This browser's notification address is not supported.");
  const id = await subId(endpoint);
  return { id, endpoint };
}

/* ---------- create ---------- */
export async function createAlert(env, body, now, provider, ipAllowed) {
  const db = env.DB;
  const sub = await subFor(db, body.subscription && body.subscription.endpoint, env);
  const o = body.option || {};
  const up = v => String(v || "").trim().toUpperCase();
  const a = { train: up(o.train), cls: up(o.cls), quota: up(o.quota), book_from: up(o.book_from), book_to: up(o.book_to), board: up(o.board || o.book_from),
    origin: up(o.origin || o.book_from), dest: up(o.dest || o.book_to), book_date: String(o.book_date || ""), train_name: String(o.train_name || "").slice(0, 60) };
  if (!TRAIN.test(a.train) || !ALL_CLASSES.concat(["EC", "EA"]).includes(a.cls) || !["GN", "TQ"].includes(a.quota) ||
      ![a.book_from, a.book_to, a.board, a.origin, a.dest].every(c => CODE.test(c)) || !/^\d{4}-\d{2}-\d{2}$/.test(a.book_date))
    throw new AlertError("That option cannot be watched.");
  const today = istToday(now);
  if (a.book_date < addDays(today, -1) || a.book_date > addDays(today, 62)) throw new AlertError("That date is outside the booking window.");

  const [{ n: mine }, { n: total }] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE sub = ?").bind(sub.id).first(),
    db.prepare("SELECT COUNT(*) AS n FROM alerts").first(),
  ]);
  if (mine >= 10) throw new AlertError("You already have 10 alerts. Remove one to add another.");
  if (total >= (parseInt(env.MAX_ALERTS, 10) || 500)) throw new AlertError("Alerts are full right now. Please try again later.");
  if (!(await ipAllowed())) throw new AlertError("You have added many alerts today. Please try again tomorrow.");

  // current status, and the times worth a reminder
  let b = null;
  try { b = brief(await provider.availability(a.train, a.book_from, a.book_to, a.book_date, a.cls, a.quota)); } catch (e) { if (!(e instanceof ProviderError)) throw e; }
  let tatkalAt = null, chartAt = null, expires = Date.parse(`${addDays(a.book_date, 1)}T23:59:00+05:30`);
  try {
    const stops = await provider.schedule(a.train);
    const from = stops.find(s => s.code === a.book_from), brd = stops.find(s => s.code === a.board);
    if (from && brd) {
      const travel = addDays(a.book_date, brd.day - from.day);
      const ev = Object.fromEntries((buildTimeline(stops, a.board, travel, [a.cls]) || []).map(e => [e.kind, e.when]));
      tatkalAt = ev[AC_CLASSES.has(a.cls) ? "tatkal-ac" : "tatkal-nonac"] ?? null;
      chartAt = ev["first-chart"] ?? null;
      if (ev.departure) expires = ev.departure;
    }
  } catch (e) { if (!(e instanceof ProviderError)) throw e; }
  if (expires <= now) throw new AlertError("This train has already left.");

  const id = crypto.randomUUID();
  const row = { id, sub: sub.id, ...a, rank: b ? RANK[b.level] : 0, label: b ? b.label : null, wl: b && b.level === "waitlist" ? parseInt(b.label.replace(/\D+/g, ""), 10) || null : null,
    tatkal_at: tatkalAt, tatkal_sent: tatkalAt === null || tatkalAt < now ? 1 : 0, chart_at: chartAt, chart_sent: chartAt === null || chartAt < now ? 1 : 0,
    expires, checked: now, created: now };
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO subs (id, endpoint, created) VALUES (?, ?, ?)").bind(sub.id, sub.endpoint, now),
    db.prepare(`INSERT INTO alerts (id, sub, train, train_name, cls, quota, book_from, book_to, book_date, board, origin, dest, rank, label, wl,
      tatkal_at, tatkal_sent, chart_at, chart_sent, expires, checked, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(row.id, row.sub, row.train, row.train_name, row.cls, row.quota, row.book_from, row.book_to, row.book_date, row.board, row.origin, row.dest,
        row.rank, row.label, row.wl, row.tatkal_at, row.tatkal_sent, row.chart_at, row.chart_sent, row.expires, row.checked, row.created),
  ]);
  return view(row, now);
}

/* ---------- list, delete, inbox, test ---------- */
export async function listAlerts(env, body, now) {
  const sub = await subFor(env.DB, body.endpoint, env);
  const { results } = await env.DB.prepare("SELECT * FROM alerts WHERE sub = ? ORDER BY book_date, created").bind(sub.id).all();
  return results.map(a => view(a, now));
}

export async function deleteAlert(env, body) {
  const sub = await subFor(env.DB, body.endpoint, env);
  await env.DB.prepare("DELETE FROM alerts WHERE id = ? AND sub = ?").bind(String(body.id || ""), sub.id).run();
  return { ok: true };
}

export async function takeInbox(env, body) {
  const sub = await subFor(env.DB, body.endpoint, env);
  const { results } = await env.DB.prepare("SELECT id, title, body, url FROM inbox WHERE sub = ? ORDER BY id LIMIT 10").bind(sub.id).all();
  if (results.length) await env.DB.prepare(`DELETE FROM inbox WHERE sub = ? AND id <= ?`).bind(sub.id, results[results.length - 1].id).run();
  return results;
}

export async function testAlert(env, body, now, allowed) {
  const sub = await subFor(env.DB, body.endpoint, env);
  if (!(await allowed())) throw new AlertError("Too many test notifications today.");
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO subs (id, endpoint, created) VALUES (?, ?, ?)").bind(sub.id, sub.endpoint, now),
    env.DB.prepare("INSERT INTO inbox (sub, title, body, url, created) VALUES (?, ?, ?, ?, ?)").bind(sub.id, "railseek test", "Notifications work. You will hear from us when a watched option changes.", "/", now),
  ]);
  return { result: await sendPush(sub.endpoint, env) };
}

/* ---------- the timer's work ---------- */
export function describeChange(a, b, avail) {
  // a message when the status improved, slipped from bookable, or a waitlist moved a lot
  const rank = RANK[b.level], wl = b.level === "waitlist" && avail.count !== null ? avail.count : null;
  const chance = b.chance !== null && b.chance !== undefined ? `, ${Math.round(b.chance)}% chance` : "";
  if (rank > a.rank) return { title: `${rank >= 2 ? "Seats opened" : "Booking opened"}: ${a.train} ${a.cls}`, body: `${what(a)} is now ${b.label}${chance} (was ${a.label || "unknown"}). Check IRCTC soon.` };
  if (a.rank >= 2 && rank < a.rank) return { title: `Seats gone: ${a.train} ${a.cls}`, body: `${what(a)} is now ${b.label} (was ${a.label}).` };
  if (a.rank === 1 && rank === 1 && a.wl && wl !== null && a.wl - wl >= Math.max(3, Math.ceil(a.wl * 0.25)))
    return { title: `Waitlist moving: ${a.train} ${a.cls}`, body: `${what(a)} is now ${b.label}${chance} (was ${a.label}).` };
  return null;
}

export async function runAlerts(env, now, provider) {
  const db = env.DB;
  const messages = [];   // [sub, title, body, url]
  const writes = [];
  await db.batch([
    db.prepare("DELETE FROM alerts WHERE expires < ?").bind(now),
    db.prepare("DELETE FROM inbox WHERE created < ?").bind(now - 2 * 86400000),
    db.prepare("DELETE FROM subs WHERE id NOT IN (SELECT sub FROM alerts) AND id NOT IN (SELECT sub FROM inbox) AND created < ?").bind(now - 86400000),
  ]);

  // reminders: Tatkal 20 minutes ahead, the chart when it is due; skip ones more than an hour late
  const { results: due } = await db.prepare(`SELECT * FROM alerts WHERE (tatkal_sent = 0 AND tatkal_at <= ?) OR (chart_sent = 0 AND chart_at <= ?) LIMIT 40`)
    .bind(now + 20 * 60000, now).all();
  for (const a of due) {
    if (!a.tatkal_sent && a.tatkal_at <= now + 20 * 60000) {
      if (a.tatkal_at > now - 3600000) messages.push([a.sub, `Tatkal opens at ${fmt(a.tatkal_at, "%H:%M")}`, `For ${what(a)}. Log in to IRCTC a few minutes early. Now: ${a.label || "unknown"}.`, searchUrl(a)]);
      writes.push(db.prepare("UPDATE alerts SET tatkal_sent = 1 WHERE id = ?").bind(a.id));
    }
    if (!a.chart_sent && a.chart_at <= now) {
      if (a.chart_at > now - 3600000) messages.push([a.sub, `Chart time for ${a.train}`, `The first chart for ${what(a)} is due about now. Leftover berths go on sale as current booking, so check IRCTC.`, searchUrl(a)]);
      writes.push(db.prepare("UPDATE alerts SET chart_sent = 1 WHERE id = ?").bind(a.id));
    }
  }

  // status checks, a few station pairs per call
  const { results: stale } = await db.prepare("SELECT * FROM alerts WHERE checked < ? ORDER BY checked LIMIT 60").bind(now - CHECK_EVERY).all();
  const groups = new Map();
  for (const a of stale) {
    const k = `${a.book_from}|${a.book_to}|${a.book_date}`;
    if (!groups.has(k) && groups.size >= MAX_GROUPS_PER_RUN) continue;
    (groups.get(k) || groups.set(k, []).get(k)).push(a);
  }
  let checked = 0, stopped = "";
  for (const list of groups.values()) {
    if (stopped) break;
    for (const a of list) {
      let avail;
      try { avail = await provider.availability(a.train, a.book_from, a.book_to, a.book_date, a.cls, a.quota); }
      catch (e) { if (!(e instanceof ProviderError)) throw e; stopped = e.message; break; }
      checked++;
      const b = brief(avail);
      if (!b) { writes.push(db.prepare("UPDATE alerts SET checked = ? WHERE id = ?").bind(now, a.id)); continue; }
      const change = describeChange(a, b, avail);
      if (change) messages.push([a.sub, change.title, change.body, searchUrl(a)]);
      const wl = b.level === "waitlist" && avail.count !== null ? avail.count : null;
      writes.push(db.prepare("UPDATE alerts SET rank = ?, label = ?, wl = ?, checked = ? WHERE id = ?").bind(RANK[b.level], b.label, wl, now, a.id));
    }
  }

  for (const [sub, title, body, url] of messages) writes.push(db.prepare("INSERT INTO inbox (sub, title, body, url, created) VALUES (?, ?, ?, ?, ?)").bind(sub, title, body, url, now));
  if (writes.length) await db.batch(writes);

  // one push per browser; it then fetches all its messages
  const subs = [...new Set(messages.map(m => m[0]))].slice(0, MAX_PUSHES_PER_RUN);
  let pushed = 0, gone = 0;
  if (subs.length) {
    const { results: rows } = await db.prepare(`SELECT id, endpoint FROM subs WHERE id IN (${subs.map(() => "?").join(",")})`).bind(...subs).all();
    for (const s of rows) {
      const r = await sendPush(s.endpoint, env);
      if (r === "sent") pushed++;
      if (r === "gone") { gone++; await db.batch([db.prepare("DELETE FROM alerts WHERE sub = ?").bind(s.id), db.prepare("DELETE FROM inbox WHERE sub = ?").bind(s.id), db.prepare("DELETE FROM subs WHERE id = ?").bind(s.id)]); }
    }
  }
  const { n: remaining } = await db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE checked < ?").bind(now - CHECK_EVERY).first();
  return { reminders: due.length, checked, messages: messages.length, pushed, gone, remaining: stopped ? 0 : remaining, stopped };
}
