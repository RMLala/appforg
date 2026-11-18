ALTER TABLE usage_daily ADD COLUMN cloud_sync_requests INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS cloud_usage_daily (
  license_id TEXT NOT NULL REFERENCES licenses(id),
  day TEXT NOT NULL,
  sync_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(license_id, day)
);
