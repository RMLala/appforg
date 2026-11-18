ALTER TABLE licenses ADD COLUMN cloud_enabled INTEGER NOT NULL DEFAULT 1 CHECK(cloud_enabled IN (0,1));
CREATE TABLE IF NOT EXISTS cloud_sessions (
  token_hash TEXT PRIMARY KEY,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  product_id TEXT NOT NULL REFERENCES products(product_id),
  installation_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cloud_sessions_license ON cloud_sessions(license_id, installation_hash, expires_at);
CREATE TABLE IF NOT EXISTS cloud_records (
  license_id TEXT NOT NULL REFERENCES licenses(id),
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(license_id, record_id)
);
CREATE TABLE IF NOT EXISTS cloud_sync_ops (
  license_id TEXT NOT NULL REFERENCES licenses(id),
  op_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(license_id, op_id)
);
CREATE TABLE IF NOT EXISTS cloud_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  record_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cloud_changes_license_seq ON cloud_changes(license_id, seq);
