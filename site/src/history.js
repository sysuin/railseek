// Waitlist history: each fresh ConfirmTkt answer adds a row per train and class (general quota)
// for the hour ConfirmTkt saved it. Rows for an hour already stored are ignored, so repeat
// searches cost no writes.

const MAX_ROWS = 80;

export function historyRows(frm, to, on, rows) {
  const out = [];
  for (const r of rows) for (const [cls, e] of Object.entries(r.gn || {})) {
    if (!e || e.d !== on || !e.a || e.t.length !== 19) continue;
    const hour = Math.floor((Date.parse(e.t + "+05:30")) / 3600000);
    if (!Number.isFinite(hour)) continue;
    // the train's own stations: a search to NDLS can return a train that ends at ANVT
    out.push([`${r.number}|${r.board || frm}|${r.alight || to}|${on}|${cls}|GN`, on, hour, e.a.slice(0, 40), e.p]);
  }
  return out.slice(0, MAX_ROWS);
}

export function recorder(db, ctx) {
  if (!db) return null;
  return (frm, to, on, rows) => {
    const items = historyRows(frm, to, on, rows);
    if (!items.length) return;
    const stmt = db.prepare("INSERT OR IGNORE INTO history (opt, day, hour, status, chance) VALUES (?, ?, ?, ?, ?)");
    ctx.waitUntil(db.batch(items.map(i => stmt.bind(...i))).catch(e => console.error("history write failed:", e.message)));
  };
}

export async function readHistory(db, o) {
  const opt = `${o.train}|${o.book_from}|${o.book_to}|${o.book_date}|${o.cls}|GN`;
  const { results } = await db.prepare("SELECT hour, status, chance FROM history WHERE opt = ? ORDER BY hour DESC LIMIT 48").bind(opt).all();
  return results.reverse().map(r => ({ at: r.hour * 3600000, status: r.status, chance: r.chance }));
}
