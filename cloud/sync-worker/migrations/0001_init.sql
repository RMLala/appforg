CREATE TABLE IF NOT EXISTS cloud_snapshots (
  license_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (license_id, app_id)
);
CREATE TABLE IF NOT EXISTS cloud_usage (
  license_id TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  PRIMARY KEY (license_id, day)
);
CREATE INDEX IF NOT EXISTS idx_cloud_usage_day ON cloud_usage(day);
