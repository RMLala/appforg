CREATE TABLE IF NOT EXISTS cloud_snapshots (
  access_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (access_id, product_id, resource)
);
CREATE INDEX IF NOT EXISTS idx_cloud_snapshots_updated ON cloud_snapshots(updated_at);
