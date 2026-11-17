# AppForge Studio 15.8 — finalisation V3

Date : 17 novembre 2026  
Base : `main` au commit `15b3b6a` et branche `work/appforge-v15.9-v3-integrations-20261117`.
Version affichée : 15.8.0; Android `versionCode` porté à 159 pour la livraison suivante.
Référentiel : `RMLala/android-template/APPFORGE-STANDARD-V3.md`.

## Implémentations ajoutées dans cette branche

| Besoin | Implémentation | Preuve disponible / limite |
|---|---|---|
| Déverrouillage Android | Prompt natif biométrie forte avec code de verrouillage système en secours; écran couvrant l’interface tant que le déverrouillage échoue. | Code Capacitor natif ajouté. Un appareil configuré est requis pour le test fonctionnel; le build local est empêché par le téléchargement de Gradle bloqué par le réseau. |
| Coffre Android | L’enveloppe AES-GCM/PBKDF2 existante est maintenant chiffrée au repos par une clé AES non exportable Android Keystore. Les anciens coffres sont lus puis migrés lors du prochain déverrouillage. | Le chemin de stockage Keystore est codé; migration et comportement sur appareil restent à éprouver. En HTML standalone, le coffre reste protégé par WebCrypto/PIN et ne bénéficie pas de Keystore. |
| Accès Cloud issu d’une licence | `/v1/activate` et `/v1/trial` retournent aussi un jeton Cloud signé de six heures. `/v1/cloud/token` renouvelle ce jeton après contrôle du statut, de l’appareil et des dates. Les routes de données contrôlent à nouveau l’état courant avant chaque lecture/écriture. | Worker et migration D1 0006 ajoutés. Déploiement Cloudflare non effectué et migration D1 non exécutée dans cette session; les routes ne sont donc pas encore un service en production. |
| Synchronisation client | `GET/PUT /v1/cloud/snapshot` fournit des instantanés par licence/appareil logique, taille limitée à 450 Ko, numéro de révision et rejet 409 des écritures concurrentes. Les essais de 3 jours utilisent une portée dédiée. | Contrôle de concurrence optimiste atomique prévu par mise à jour conditionnelle SQL. Tests D1/Cloudflare et intégration d’une application cliente réelle requis avant déclaration opérationnelle. |
| Google Drive | Android ouvre la feuille de partage native pour exporter, et le sélecteur système pour restaurer. Le chiffrement de sauvegarde par mot de passe est proposé; l’import exige confirmation avant remplacement. | Code natif et UI présents; compte Drive, permissions du fournisseur de documents et restauration sur appareil réel non testés. Navigateur standalone conserve le sélecteur HTML existant. |
| PromptiPro | La navigation AppForge retire les destinations générateur guidé/avancé. Le flux ouvre PromptiPro, qui reçoit l’ancien projet sélectionné et inclut maintenant un concepteur de cahier des charges autonome, avec génération, copie et téléchargement. | HTML construit et contenu vérifiable; transfert de projets existants et ouverture depuis Android doivent être exercés en UI. |
| APK | CI Android réussie sur le commit `46c79b0`: APK Debug API 23 et Releases API 23/API 29 signées, vérifiées par `apksigner`; `versionCode` 159 et `versionName` 15.8.0. Les deux Releases partagent le même certificat. | Artefacts vérifiables: run `44058255904`; Debug `14316338026`; Releases `14317167196`. Les APK compilent; les parcours de l'application restent à tester sur appareil. |
| PWA | Aucune PWA ajoutée. | Aucun manifeste ni service worker dans les sources. |

## Configuration Cloud requise avant production

1. Vérifier le D1 indiqué dans `cloud/license-worker/wrangler.toml` et appliquer la nouvelle migration `0006_cloud_snapshots.sql`.
2. Déployer le Worker avec `LICENSE_SIGNING_PRIVATE_JWK`, `CODE_HASH_PEPPER` et `ADMIN_API_TOKEN` configurés en secrets Wrangler; ne pas inclure ces valeurs dans le dépôt, l’HTML ou l’APK.
3. Configurer dans les applications clientes l’URL HTTPS du Worker et l’identifiant de produit; obtenir `cloudAccess` lors de l’activation/essai et appeler les routes documentées dans le guide Worker.
4. Tester activation, renouvellement, expiration, révocation, appareil retiré, deux écritures simultanées et fonctionnement hors ligne avec D1 réel.

## Vérifications faites dans l’environnement de développement

- `npm ci` a réussi.
- `npm run build` et `npm run sync` ont réussi; la copie Android contient le HTML AppForge, `PromptiPro.html` et le pont JavaScript Capacitor.
- `node --check` sur le Worker et `git diff --check` réussissent.
- Le build Gradle local n’a pas démarré car Gradle 8.11.1 ne pouvait pas être téléchargé dans cet environnement. La CI GitHub a ensuite compilé Debug API 23 et les deux Releases, puis vérifié les signatures; le run Android `44058255904` est réussi.
- Workflows du commit `46c79b0` réussis : Android `44058255904`, conformité V3 `44058255950`, contrôle central `44058256701`.
- Aucun test sur appareil Android réel ni déploiement Cloudflare n’a été effectué.

## Décision de statut

La branche contient les changements de code et les Actions ainsi que les APK sont vérifiés. AppForge Studio ne doit pas encore être déclarée « Finalisée » : le déploiement/configuration D1, les appels Cloud réels et les parcours biométrie, coffre et sauvegarde/restauration Android n’ont pas de preuve d’exécution sur les systèmes cibles. La PR #8 reste ouverte pour validation fonctionnelle avant fusion.
