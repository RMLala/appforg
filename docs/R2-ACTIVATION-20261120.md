# Mise en service R2 — AppForge Cloud V3 (20 novembre 2026)

## État et périmètre
R2 est destiné aux **fichiers binaires de sauvegarde** et reste privé. D1 conserve les licences, les essais, les petits snapshots JSON et les métadonnées des objets R2. Le bucket prévu est **`appforge-cloud-files`**, lié au Worker central comme `FILE_BUCKET`. Les clients ne reçoivent jamais de clé R2 ou Cloudflare.

Cette PR **prépare** la production, mais seul le workflow manuel ci-dessous déploie. Les anciennes routes `/v1/cloud/snapshot` et les données D1 ne sont pas migrées ou supprimées.

## Activation depuis GitHub sur téléphone
1. Dans **RMLala/appforg → Settings → Secrets and variables → Actions**, vérifier les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` ; **ne jamais copier leur valeur dans un chat ou le dépôt**.
2. Dans Cloudflare, vérifier que **R2 Object Storage est activé** sur le compte du Worker `appforge-license-api`. Le bucket peut être créé manuellement en privé (sans domaine public).
3. Après fusion de la PR, ouvrir **Actions → Activate AppForge private R2 (manual) → Run workflow**, choisir `main` et saisir exactement `ACTIVER-R2`.
4. Le workflow vérifie les secrets sans les afficher, crée `appforge-cloud-files` uniquement s'il est absent, examine les migrations D1, **refuse de poursuivre si d'autres migrations plus anciennes restent en attente**, applique ensuite la migration additive `0008_cloud_files_r2.sql`, déploie le Worker central et contrôle `/health`, `/v1/config` et le refus HTTP 401 sans jeton sur la route R2.
5. En cas d'échec, inspecter le journal du job et corriger le blocage. **Ne pas lancer une migration plus ancienne sans examiner son effet sur D1 production.**

Le schéma R2 est additif : `cloud_files` est créé sans modifier les tables existantes. Cloudflare documente la sauvegarde automatique lors de `wrangler d1 migrations apply`, mais elle ne remplace pas une vérification préalable de l'environnement de production.

## Routes R2 (jeton Cloud signé requis)
| Méthode | URL | Rôle |
|---|---|---|
| GET | `/v1/cloud/quota` | Quotas D1 + R2 réels ; `r2.available=true` si binding et métadonnées utilisables |
| GET | `/v1/cloud/files` | Fichiers propres à la licence / à l'essai |
| PUT | `/v1/cloud/file?fileId=backup_20261120` | Charger un binaire via `X-AppForge-Expected-Revision: 0` pour un nouveau fichier |
| GET | `/v1/cloud/file?fileId=backup_20261120` | Récupérer le binaire avec `X-AppForge-Revision` et `X-AppForge-SHA256` |

La réécriture d'un fichier utilise sa révision actuelle comme valeur attendue ; une révision dépassée renvoie 409. Les erreurs de quota renvoient 413. Les quotas initiaux sont de 20 Mio R2 par essai, 100 Mio par licence payée, 10 Mio maximum par fichier et 100 fichiers. Les fichiers ne sont **pas automatiquement chiffrés de bout en bout** : chiffrer côté client les sauvegardes sensibles avant l'envoi.

## Test de production obligatoire
Avec **une licence de test dédiée et un appareil autorisé**, obtenir un jeton signé depuis `POST /v1/cloud/token` (à partir de la preuve de licence), puis vérifier :
- `GET /v1/cloud/quota` : `r2.available=true` ; valeurs R2 non nulles.
- `PUT` d'un petit fichier de test sous un `fileId` inédit, réponse 201, puis `GET` du même fichier et comparaison du SHA-256.
- `GET /v1/cloud/files` : seule la licence de test voit le fichier.
- Une lecture sans jeton retourne 401 ; une autre licence ne doit pas lire le fichier (404).
- Les snapshots D1 et la synchronisation existante restent opérationnels.

**Important :** les builds et le test de démarrage Android ne prouvent pas la création réelle du bucket ni un transfert R2 en production. N'annoncer « R2 actif » qu'après le test authentifié. L'intégration des boutons d'import/export de fichier R2 dans les applications est un travail client distinct.
