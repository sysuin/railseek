-- Saved availability over time, one row per option per hour of ConfirmTkt's own save time.
-- Kept until the day after the journey; used to show whether a waitlist is moving.
CREATE TABLE IF NOT EXISTS history (
  opt TEXT NOT NULL,          -- train|from|to|date|class|quota
  day TEXT NOT NULL,          -- journey date, for clean-up
  hour INTEGER NOT NULL,      -- hours since 1970 (UTC) of ConfirmTkt's save time
  status TEXT NOT NULL,
  chance REAL,
  PRIMARY KEY (opt, hour)
);
CREATE INDEX IF NOT EXISTS history_day ON history(day);
