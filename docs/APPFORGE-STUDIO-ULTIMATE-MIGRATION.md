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


## UX/UI validée — navigation compacte, tactile et responsive
- Desktop/tablette : sidebar gauche rétractable (icônes + infobulles en mode compact), sections Studio / Business / Licences / Cloud / Pilotage / Réglages, topbar avec titre, recherche et actions contextuelles.
- Mobile : barre basse de 4 destinations maximum (Accueil, Projets, Business, Cloud), bouton « Plus » pour les sections secondaires ; respecter safe-area Android et clavier virtuel.
- Bouton Retour visible en haut à gauche dans les sous-écrans, relié à un historique interne cohérent ; Android Back et Escape suivent le même parcours ; en cas de formulaire modifié, demander confirmation avant sortie.
- Menu trois points (⋮) en haut à droite pour actions contextuelles : exporter, dupliquer, aide, paramètres ; seules les actions pertinentes sont affichées et chaque action est fonctionnelle.
- Navigation persistante sans doublons sidebar/barre basse ; conserver section, filtres et position de défilement lors d'un retour ; focus accessible, labels, tailles tactiles >=44px.
- Pas de boutons morts ; états chargement, hors ligne, erreur, confirmation et notification ; recherche et filtres dans les modules complexes.
- Vérifier la navigation sur écran étroit, tablette, desktop, rotation, clavier, Android Back, modales et menus ; éviter le masquage du contenu par la barre basse.

## Source Business Manager localisée dans la Library
- Référence exacte : `libfile_6906f6a525348191a05b854a43fc565c`, `AppForge-Business-Manager-v1.6.0-Worker-Lalainaadclick.html` (168386 octets, 904 lignes dans l'index Library).
- Lecture textuelle de la source effectuée : HTML standalone avec sidebar et sections métier, CRM, devis/factures, projets et configuration Cloud. Son code n'est pas encore importé.
- La Library permet la lecture indexée, mais la copie brute autorisée vers le conteneur a échoué ; ne pas prétendre disposer d'un fichier source intégral exploitable pour une migration automatique avant obtention des octets.

## Bloqueurs actuels
1. Source Business Manager v1.6.0 localisée et lisible dans Library, mais extraction brute refusée ; obtenir un fichier HTML montable ou une voie de copie autorisée avant intégration.
2. Aucun Product ID Business Manager confirmé : ne pas en inventer.
3. R2 non configuré et authentification admin déléguée non implémentée.

## Prochaine PR technique
Importer les modules métier uniquement après inspection de la source v1.6.0 et tests de non-régression. Ne pas copier `RMLala/bizn`.
