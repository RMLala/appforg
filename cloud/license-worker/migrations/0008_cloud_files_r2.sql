-- Non-destructive R2 metadata. Existing D1 snapshots and licence tables are unchanged.
CREATE TABLE IF NOT EXISTS cloud_files (
  access_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (access_id, product_id, file_id)
);
CREATE INDEX IF NOT EXISTS idx_cloud_files_usage ON cloud_files(access_id, product_id);