# AppForge Studio Ultimate — Audit initial et migration progressive

Date : 2026-11-19. Statut : planification, aucune fusion applicative exécutée.

## Sources vérifiées
- `RMLala/appforg` : README et package.json, application Android Capacitor AppForge Studio v15.8.8 ; Worker central dans `cloud/license-worker/`, SDK Cloud et tests.
- Repositories accessibles sous RMLala : aucun dépôt dédié AppForge Business Manager identifié. `RMLala/bizn` est Biznako v1.2.0 et NE DOIT PAS être confondu avec Business Manager.
- Audit antérieur Business Manager : dernier livrable connu `AppForge-Business-Manager-v1.6.0-Worker-Lalainaadclick.html` (HTML autonome) ; source HTML intégrale non disponible dans ce dépôt. Pas de Product ID Business Manager confirmé en D1. Ne pas réutiliser `APPFORGE-STUDIO` ou `PROMPTI-V1` pour l'ancienne application.

## Cible
Une seule application installable, AppForge Studio Ultimate, avec modules cloisonnés :
1. Studio : projets, code, prompts, GitHub, builds, versions, APK.
2. Business : catalogue, clients, ventes, paiements MVola à validation manuelle, licences, appareils, renouvellements et révocations.
3. Cloud : D1/R2, sauvegardes, restauration, conflits, quotas par application et licence, coûts estimés et alertes.
4. Supervision : diagnostics, audit, support, rôles et permissions.

Le Worker AppForge central reste l'autorité unique. Aucun secret administrateur, clé R2, jeton permanent ni mot de passe dans HTML, APK ou dépôt. Les API admin existantes ne doivent pas être exposées au client : implémenter des sessions administrateur déléguées à droits limités, avec tests, avant toute administration réelle.

## Phases avec critères de sortie
### 0. Inventaire et sauvegarde
- Obtenir et auditer le HTML Business Manager v1.6.0 complet, ses schémas de stockage et ses fonctions ; établir une matrice de correspondance écran/fonction/donnée.
- Relever la configuration Studio actuelle, versions, scripts, APK, GitHub Actions et tests ; sauvegarder les données locales des deux applications.
- Pas de suppression, renommage de Product ID, migration D1 ni déploiement.

### 1. Coque unifiée et modules
- Ajouter un module Business dans Studio sous un espace de noms distinct ; aucun écrasement des clés de stockage Studio.
- Migration de données versionnée, idempotente, import explicite avec aperçu et retour arrière ; prise en charge des anciennes sauvegardes.
- Navigation commune, À propos & Support, rôles propriétaire/administrateur/lecture seule.

### 2. Administration licences sécurisée
- Adapter Worker central : sessions déléguées à durée courte, MFA/confirmation pour actions sensibles, RBAC côté serveur, journal d'audit et révocation.
- Réutiliser les produits et licences existants sans changer leurs identifiants.
- Paiement MVola toujours validé manuellement avant activation commerciale.

### 3. Cloud et quotas
- Conserver les snapshots D1 fonctionnels ; ajouter R2 privé seulement après bucket/binding autorisés.
- Quotas par licence/application et budget global, alertes 80/90/100 %, stockage mesuré, compteurs d'opérations estimés/mesurés clairement séparés.
- Restaurer D1+R2 par fusion sans écrasement silencieux, mode offline-first et tests de conflits.

### 4. Recette et bascule
- Tests fonctionnels, sécurité, migrations/rollback, Cloud avec licence test, builds HTML et Android Debug + deux Release signées (API 23/API 29).
- PR + CI obligatoires. Conserver Business Manager autonome en archive fonctionnelle jusqu'à validation de parité et récupération des données.
- Bascule uniquement après approbation explicite, aucune modification de production dans cette phase.

## Bloqueurs actuels
1. Source intégrale Business Manager v1.6.0 non identifiée dans GitHub ; demander son fichier exact si inaccessible depuis Project/Library.
2. Aucun Product ID Business Manager confirmé : ne pas en inventer.
3. R2 non configuré et authentification admin déléguée non implémentée.

## Prochaine PR technique
Importer les modules métier uniquement après inspection de la source v1.6.0 et tests de non-régression. Ne pas copier `RMLala/bizn`.
