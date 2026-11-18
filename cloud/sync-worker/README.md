# AppForge Cloud Sync Worker

Cloudflare Worker + D1 sync API for WorshipFlow. Clients do not create a Cloud account, choose an organization, or submit an email/password.

## Routes

- `POST /v2/session/issue` and `POST /v2/session/refresh`: body has `productId`, `licenseToken`, and `installationId`. The Worker calls the license Worker status route; only an active paid license and registered device with Cloud rights receive a short lived HMAC token.
- `GET /v2/snapshot` and `PUT /v2/snapshot`: require the Cloud bearer token plus `X-AppForge-License-Proof` and `X-AppForge-Installation`. The license Worker is rechecked on every read/write so revocation and device removal take effect immediately.
- Snapshot rows are isolated by license ID and product. Writes use compare-and-swap revision numbers. Offline edits stay on the device and are submitted after reconnect.

## Deploy

1. Create a separate D1 database for Cloud snapshots; do not reuse the license database.
2. Replace the example `database_id` in `wrangler.toml` with the created D1 ID.
3. Configure `CLOUD_TOKEN_SECRET` with at least 32 random characters using `wrangler secret put CLOUD_TOKEN_SECRET`.
4. Apply migrations and deploy from this directory.
5. Set the WorshipFlow client Cloud base URL to the deployed Worker URL. The license Worker must first expose the paid-license entitlement fields documented below.

This PR prepares source and migrations only; it does not deploy Cloudflare resources. The existing Cloud Worker source was not present in the repository, so no production Worker was overwritten.

## License Worker contract

`POST /v1/status` should return `active:true`, `kind:"license"`, `cloud:true`, `licenseId`, and `expiresAt` only after checking the paid payment, status, expiry, and active device. Trials must return `kind:"trial"` and `cloud:false`. Cloud token issuance is denied otherwise.
