# Intégration progressive — Business Manager v1.7.2

Cette branche prépare la livraison de `modules/business-manager/index.html` comme module HTML isolé, sans modifier le Worker, la D1 ou le Studio actuel.

## Travail réalisé
- `scripts/build.cjs` embarque le module Business Manager si sa source est présente dans le dépôt.
- Si la source est absente, le build Studio actuel continue inchangé (aucun faux module ou lien mort).
- Contrôle élémentaire de la structure HTML avant empaquetage.

## Source réelle et validation
- Source locale reçue : `AppForge-Business-Manager-v1.7.2-Retour-Android-Menu-Corrige.html` ; navigation Android validée par l'utilisateur.
- **À faire** : ajouter cette source complète dans `modules/business-manager/index.html` via un canal GitHub autorisé, puis intégrer l'accès dans la navigation Studio avec gestion correcte du retour Android.
- La source contient potentiellement des préférences locales et des connexions Cloud : auditer les appels, clés localStorage et Product ID avant toute migration des données. Ne pas importer de données personnelles dans GitHub.
- Ne pas afficher un menu Business Manager avant que son fichier soit réellement livré.

## Tests bloquants avant fusion
1. `npm ci && npm run build` avec et sans module ; vérification des sorties.
2. Non-régression Studio/PromptiPro, fonctionnement de Business Manager v1.7.2, navigation Retour Android et menu ⋮.
3. Audit des secrets et de l'authentification admin, séparation des espaces de stockage, sauvegarde et restauration.
4. Test Android réel, D1 avec licence dédiée, puis APK Debug et deux APK Release signées.

Ne pas fusionner cette PR avant intégration réelle et recette. Aucun déploiement de production demandé.
