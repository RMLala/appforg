ALTER TABLE licenses ADD COLUMN license_type TEXT NOT NULL DEFAULT 'legacy';
UPDATE licenses SET license_type = plan WHERE license_type = 'legacy';
CREATE INDEX IF NOT EXISTS idx_licenses_expiration ON licenses(status, expires_at);
