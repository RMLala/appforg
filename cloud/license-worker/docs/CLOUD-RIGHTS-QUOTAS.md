# Cloud par licence : droits et quotas — changement préparé, non déployé

Complément à la PR AppForge Studio #8 et à la règle android-template #7. Aucune migration distante ni modification du D1 de production n'est effectuée par cette PR.

## Contrôles ajoutés

- `cloud_enabled` est vérifié lors de l'émission/du renouvellement du jeton et de chaque lecture/écriture distante. Une licence valide sans droit Cloud reste une licence valide : activation réussie, `cloudAccess.enabled=false`, aucun jeton accordé.
- `cloud_quota_bytes` limite le stockage cumulé de tous les instantanés/fragments d'une licence et d'un produit. Le contrôle est inclus dans l'instruction SQL conditionnelle : deux écritures concurrentes sur des ressources distinctes ne peuvent pas dépasser ensemble le quota. Les révisions concurrentes continuent à donner HTTP 409.
- `cloud_requests_day` est compté par licence/produit/jour UTC avec incrément SQL conditionnel ; dépassement : HTTP 429. Les quotas des licences sont isolés.
- Dépassement de taille par requête (450 Ko) ou de stockage : HTTP 413. Aucun effacement des données existantes.
- Quota d'appareils rendu atomique à l'activation : deux activations simultanées ne peuvent pas dépasser `max_devices`.
- Expiration du jeton bornée par l'expiration de licence/essai. Les vérifications de licence, produit et appareil restent exécutées sur chaque opération, même avec un jeton non expiré.

## Administration authentifiée

`GET /admin/licenses/:id/cloud` retourne `{enabled,maxBytes,requestsDay}`.

`PATCH /admin/licenses/:id/cloud` reçoit `{enabled:boolean,maxBytes:integer,requestsDay:integer}`. Cette route exige le secret administrateur existant côté serveur ; elle n'est pas destinée au client et n'est pas intégrée à CPV.

Valeurs techniques par défaut, modifiables par l'éditeur : licence 100 Mio et 10 000 requêtes/jour ; essai 5 Mio et 1 000 requêtes/jour. Elles ne constituent pas des offres commerciales décidées par le client. Réduire un quota sous l'usage actuel bloque les nouvelles écritures qui l'augmentent sans supprimer les données.

Les fragments non référencés comptent encore dans le stockage. Leur collecte n'est pas ajoutée ici : elle exige une politique de conservation et une connaissance des formats d'application. L'interface d'administration AppForge Studio pourra utiliser ces routes ; cette PR ajoute les contrôles serveur.

## Mise en service et limites

1. Vérifier la sauvegarde et le D1 cible du Worker existant.
2. Appliquer les migrations de la PR #8, puis `0007_cloud_entitlements_quotas.sql`.
3. Déployer le Worker, sans exposer les secrets dans GitHub/HTML/APK.
4. Fixer les droits et quotas commerciaux réellement souhaités dans AppForge Studio.
5. Valider une vraie licence après paiement MVola confirmé sur deux appareils, puis expiration, révocation, suspension et quotas.

Tests automatisés : véritable Worker/migrations SQL sur SQLite en mémoire, clés de signature éphémères et données synthétiques. Ils vérifient les droits, le quota cumulé sous concurrence, le quota journalier, l'isolation, le refus admin sans autorisation, l'expiration et le plafond d'appareils sous concurrence. Aucun paiement MVola réel, D1 de production ou appareil physique n'est utilisé. Une CI verte ne certifie pas la mise en service.
