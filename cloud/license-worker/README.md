# AppForge License Worker

Cloudflare Worker + D1 API for product registration, activation, trials, signed offline proofs, status checks and administrator-managed licenses.

## Deploy this source

1. Use the existing `appforge-licenses` D1 database configured in `wrangler.toml`.
2. From this folder, run `npm install` and `npm run db:migrate:remote`.
3. Configure `ADMIN_API_TOKEN`, `LICENSE_SIGNING_PRIVATE_JWK` and `CODE_HASH_PEPPER` as Wrangler secrets. Never put these values in the frontend or repository.
4. Run `npm run deploy` and verify `/health` and `/v1/config`.

Migration `0005_admin_crud.sql` adds non-destructive deletion markers. The API now supports modifying or deleting products and license metadata. Deleting an issued license revokes it immediately and hides it from the normal list while retaining its activation/history rows. Deleting a product with license history archives it; a product with no history can be physically removed.

The Worker is source-controlled here; this push does not deploy it to Cloudflare. The AppForge front end displays a clear API error until the deployed Worker has migration 0005 and these routes.
# AppForge License and Cloud Worker

Le Worker gère les essais, les licences, les appareils et les instantanés Cloud client dans le D1 configuré par `wrangler.toml`.

## Routes Cloud client

- `POST /v1/trial` et `POST /v1/activate` retournent la preuve de licence et un champ `cloudAccess` contenant un jeton signé valable six heures. Les applications clientes n’ont pas à envoyer un mot de passe ou un e-mail.
- `POST /v1/cloud/token` renouvelle le jeton à partir de `productId`, `installationId` et `licenseToken`. Le Worker vérifie de nouveau l’essai/la licence et l’activation de l’appareil.
- `GET /v1/cloud/snapshot?resource=...` lit un instantané de la licence.
- `PUT /v1/cloud/snapshot?resource=...` reçoit `{ "expectedRevision": 0, "snapshot": {} }`. Les écritures sont conditionnelles à la révision. Une modification concurrente retourne `409` et l’instantané actuel.

Chaque requête Cloud revérifie l’état de licence, la date et l’appareil dans D1. L’expiration, la révocation ou le retrait d’un appareil bloque donc les nouvelles lectures/écritures même si le jeton de six heures existe encore. Les données restent locales dans l’application cliente lorsque le Worker est indisponible. Les instantanés D1 ne sont pas chiffrés de bout en bout.

## Mise en service

1. Vérifier le D1 de production et ses sauvegardes avant migration.
2. Appliquer `migrations/0006_cloud_snapshots.sql` avec Wrangler.
3. Définir `ADMIN_API_TOKEN`, `LICENSE_SIGNING_PRIVATE_JWK` et `CODE_HASH_PEPPER` via `wrangler secret put`.
4. Déployer le Worker et vérifier `/health`, `/v1/config`, essai, activation, synchronisation, conflit, expiration et révocation.

Ne pas déployer les migrations à distance sans vérifier l’environnement D1 cible. Les tests de développement et le déploiement ne sont pas implicites dans `npm run build`.
