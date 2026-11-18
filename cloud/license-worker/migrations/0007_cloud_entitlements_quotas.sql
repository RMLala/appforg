-- Non-destructive, configurable technical defaults; not commercial plan definitions.
ALTER TABLE licenses ADD COLUMN cloud_enabled INTEGER NOT NULL DEFAULT 1 CHECK(cloud_enabled IN (0,1));
ALTER TABLE licenses ADD COLUMN cloud_quota_bytes INTEGER NOT NULL DEFAULT 104857600 CHECK(cloud_quota_bytes BETWEEN 1024 AND 1073741824);
ALTER TABLE licenses ADD COLUMN cloud_requests_day INTEGER NOT NULL DEFAULT 10000 CHECK(cloud_requests_day BETWEEN 1 AND 100000);
CREATE TABLE IF NOT EXISTS cloud_usage_daily (
 access_id TEXT NOT NULL, product_id TEXT NOT NULL, day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(access_id,product_id,day)
);
