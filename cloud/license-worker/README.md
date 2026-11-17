# AppForge License Worker

Cloudflare Worker + D1 API for product registration, activation, trials, signed offline proofs, status checks and administrator-managed licenses.

## Deploy this source

1. Use the existing `appforge-licenses` D1 database configured in `wrangler.toml`.
2. From this folder, run `npm install` and `npm run db:migrate:remote`.
3. Configure `ADMIN_API_TOKEN`, `LICENSE_SIGNING_PRIVATE_JWK` and `CODE_HASH_PEPPER` as Wrangler secrets. Never put these values in the frontend or repository.
4. Run `npm run deploy` and verify `/health` and `/v1/config`.

Migration `0005_admin_crud.sql` adds non-destructive deletion markers. The API now supports modifying or deleting products and license metadata. Deleting an issued license revokes it immediately and hides it from the normal list while retaining its activation/history rows. Deleting a product with license history archives it; a product with no history can be physically removed.

The Worker is source-controlled here; this push does not deploy it to Cloudflare. The AppForge front end displays a clear API error until the deployed Worker has migration 0005 and these routes.
