from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(":memory:")
for migration in sorted((root / "migrations").glob("*.sql")):
    db.executescript(migration.read_text(encoding="utf-8"))

expected = {"cloud_sessions", "cloud_records", "cloud_sync_ops", "cloud_changes", "cloud_usage_daily"}
actual = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert expected <= actual, f"Missing tables: {expected - actual}"
columns = {row[1] for row in db.execute("PRAGMA table_info(licenses)")}
assert {"cloud_enabled", "license_type"} <= columns

db.execute("INSERT INTO products(product_id,name,status,created_at) VALUES('TEST-APP','Test','active','now')")
for license_id in ("license-a", "license-b"):
    db.execute(
        "INSERT INTO licenses(id,product_id,customer_name,code_hash,status,paid_confirmed,plan,payment_reference,created_at,license_type) "
        "VALUES(?,?,?,?,'active',1,'annual','test','now','annual')",
        (license_id, "TEST-APP", license_id, license_id),
    )
db.execute("INSERT INTO cloud_records(license_id,record_id,version,payload_json,updated_at) VALUES('license-a','same-id',1,'{}','now')")
db.execute("INSERT INTO cloud_records(license_id,record_id,version,payload_json,updated_at) VALUES('license-b','same-id',1,'{}','now')")
assert db.execute("SELECT COUNT(*) FROM cloud_records WHERE record_id='same-id'").fetchone()[0] == 2
assert db.execute("SELECT cloud_enabled FROM licenses WHERE license_type='annual'").fetchone()[0] == 1
print("Worker schema check passed: migrations, entitlements, and cross-license key isolation.")
