-- Preserve license and activation history while supporting user-requested deletion from admin lists.
CREATE TABLE IF NOT EXISTS deleted_products (
  product_id TEXT PRIMARY KEY REFERENCES products(product_id),
  deleted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deleted_licenses (
  license_id TEXT PRIMARY KEY REFERENCES licenses(id),
  deleted_at TEXT NOT NULL
);
