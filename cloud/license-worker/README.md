# AppForge License Worker

Cloudflare Worker + D1 API for product registration, activation, trials, signed offline proofs, status checks and administrator-managed licenses.

## Deploy this source

1. Use the existing `appforge-licenses` D1 database configured in `wrangler.toml`.
2. From this folder, run `npm install` and `npm run db:migrate:remote`.
3. Configure `ADMIN_API_TOKEN`, `LICENSE_SIGNING_PRIVATE_JWK` and `CODE_HASH_PEPPER` as Wrangler secrets. Never put these values in the frontend or repository.
4. Run `npm run deploy` and verify `/health` and `/v1/config`.

Migration `0005_admin_crud.sql` adds non-destructive deletion markers. The API now supports modifying or deleting products and license metadata. Deleting an issued license revokes it immediately and hides it from the normal list while retaining its activation/history rows. Deleting a product with license history archives it; a product with no history can be physically removed.

The Worker is source-controlled here; this push does not deploy it to Cloudflare. The AppForge front end displays a clear API error until the deployed Worker has migration 0005 and these routes.


## Cloud automatique sans compte client (V3)

Routes ajoutées :

- `POST /v1/cloud/token` et `POST /v1/cloud/renew` : vérifient la preuve de licence signée, le paiement, l’expiration, le droit Cloud et l’appareil actif; émettent un jeton opaque valable 15 minutes. Aucun compte client n’est créé.
- `POST /v1/cloud/sync` : exige le jeton dans `Authorization: Bearer`; revalide à chaque appel la licence, l’appareil et le droit Cloud; partitionne les enregistrements par licence; traite les `opId` de façon idempotente, vérifie les versions et renvoie les conflits.
- Quota par licence configurable (`CLOUD_DAILY_SYNC_LIMIT`, 500 appels/jour par défaut), 20 changements par requête, 64 Ko par élément, curseur de reprise.

Migration 0006 ajoute le droit Cloud et les tables de jetons/données/journal; les licences existantes héritent du droit actif par défaut. Les licences de test journalières créées après mise à jour sont sans Cloud. Le droit peut être modifié avec `PATCH /admin/licenses/:id` et `cloudEnabled: true|false`.

Les données métier doivent rester localement disponibles si le réseau, le jeton ou le quota manque. Le Worker ne supprime pas les sauvegardes locales. Cette PR ajoute le code et les migrations; elle ne déploie pas le Worker Cloudflare. Après fusion, appliquer les migrations distantes et déployer avec les secrets Wrangler existants. Tester activation MVola, révocation, appareils, synchronisation multi-appareils, conflits et reprise avec une licence de test avant d’annoncer la conformité.
