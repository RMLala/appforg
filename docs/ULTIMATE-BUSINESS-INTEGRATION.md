# AppForge Ultimate — Intégration Business Manager v1.7.2

## État de la branche
Le HTML intégral validé par l'utilisateur est ajouté à `modules/business-manager/index.html`.
Le build Studio copie la source vers `dist/modules/business-manager/index.html` et Capacitor vers les assets Android. Aucun fichier de données personnelles n'est importé.

## Navigation
- Dans Studio, l'entrée « Business Manager » est ajoutée dans la navigation latérale **seulement** lorsque le module est présent.
- Dans Business Manager, la version **empaquetée seulement** propose « AppForge Studio » dans le menu ⋮, avec retour relatif vers `../../index.html`.
- Le HTML source autonome v1.7.2 reste strictement inchangé ; son historique Android, ses fonctions, sa protection PIN et son stockage local sont conservés.
- Le mécanisme de navigation arrière via l'historique Android reste celui de l'application ; il doit être validé sur l'APK Ultimate réelle.

## Contrôles automatiques
Le workflow Android lance `npm run sync`, puis `npm run test:ultimate` : vérification du HTML, du lanceur Studio, de l'entrée retour, de la copie des ressources dans Android, de la cohérence source/bundle et de la syntaxe JavaScript. Il exécute aussi les tests Cloud existants, construit l'APK Debug et les variantes Release signées, et tente les tests de lancement émulateur API 29/33.

## Limites et recette restante
Les audits automatisés et démarrages d'émulateur ne remplacent pas un test fonctionnel sur téléphone. À vérifier sur l'APK Ultimate : ouverture Studio → Business Manager → Studio, retours Android, menu ⋮, PIN, persistance locale, sauvegarde et restauration, absence d'altération des données Studio, ainsi que les flux Cloud avec une licence de test dédiée. Ne pas déclarer D1/R2 ni la licence fonctionnels sans preuves authentifiées.

Aucun changement dans le Worker Cloudflare, D1, R2 ni les données de production. Cette PR n'entraîne aucune migration ou suppression de stockage local.
