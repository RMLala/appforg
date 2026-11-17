CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','inactive')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  code_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','revoked')),
  paid_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(paid_confirmed IN (0,1)),
  plan TEXT NOT NULL CHECK(plan IN ('lifetime','annual')),
  max_devices INTEGER NOT NULL DEFAULT 1 CHECK(max_devices BETWEEN 1 AND 10),
  expires_at TEXT,
  payment_reference TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_licenses_product_created ON licenses(product_id, created_at DESC);
CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id TEXT NOT NULL REFERENCES licenses(id),
  installation_hash TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  UNIQUE(license_id, installation_hash)
);
CREATE TABLE IF NOT EXISTS activation_attempts (
  subject_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  failures INTEGER NOT NULL,
  PRIMARY KEY(subject_hash, bucket)
);
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT PRIMARY KEY,
  activation_requests INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO products(product_id,name,status,created_at)
VALUES('PROMPTI-V1','Prompti','active',CURRENT_TIMESTAMP);
