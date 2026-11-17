ALTER TABLE usage_daily ADD COLUMN trial_requests INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS trials (
  product_id TEXT NOT NULL REFERENCES products(product_id),
  installation_hash TEXT NOT NULL,
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY(product_id, installation_hash)
);

CREATE INDEX IF NOT EXISTS idx_trials_expiry ON trials(expires_at);
