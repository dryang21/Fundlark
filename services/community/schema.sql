CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  opportunity_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS contributions_review ON contributions(status, submitted_at);
CREATE INDEX IF NOT EXISTS contributions_program ON contributions(opportunity_key, status);
CREATE TABLE IF NOT EXISTS ingestion_limits (
  bucket TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ingestion_day ON ingestion_limits(day);
