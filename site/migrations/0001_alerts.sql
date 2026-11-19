-- Browser push alerts. A subscription is identified by a hash of its push endpoint.
CREATE TABLE IF NOT EXISTS subs (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  train TEXT NOT NULL, train_name TEXT, cls TEXT NOT NULL, quota TEXT NOT NULL,
  book_from TEXT NOT NULL, book_to TEXT NOT NULL, book_date TEXT NOT NULL, board TEXT NOT NULL,
  origin TEXT NOT NULL, dest TEXT NOT NULL,
  rank INTEGER NOT NULL DEFAULT 0, label TEXT, wl INTEGER,
  tatkal_at INTEGER, tatkal_sent INTEGER NOT NULL DEFAULT 0,
  chart_at INTEGER, chart_sent INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL, checked INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_sub ON alerts(sub);
CREATE INDEX IF NOT EXISTS alerts_checked ON alerts(checked);
CREATE TABLE IF NOT EXISTS inbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS inbox_sub ON inbox(sub);
