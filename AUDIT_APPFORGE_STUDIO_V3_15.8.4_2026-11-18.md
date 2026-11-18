# Audit AppForge Studio 15.8.4 — accès Cloud client par licence

Date : 18 novembre 2026  
Version : 15.8.4 · Android versionCode 164  
Branche : work/appforge-v15.9-v3-integrations-20261117

## Parcours livré dans le code

Après l’achat, le propriétaire crée la licence payée dans le portail AppForge. Le client saisit le code une seule fois dans son application. L’API /v1/activate associe l’activation à l’application et à l’installation, puis retourne une preuve de licence et un jeton Cloud signé valable six heures. Aucun compte client, e-mail, mot de passe ou choix d’organisation n’intervient.

Le module cloud/license-worker/client/appforge-cloud-sync.js complète ce parcours :

- persiste la preuve, le jeton et l’identifiant d’installation; utilise le Keystore fourni par Android lorsqu’il est disponible;
- demande le renouvellement du jeton par /v1/cloud/token;
- synchronise les instantanés /v1/cloud/snapshot au démarrage, après modification locale via notifyLocalChange() et à la reconnexion réseau;
- conserve les données locales hors ligne;
- demande un choix explicite si une sauvegarde distante existe à la première connexion;
- signale les conflits 409 et ne remplace pas silencieusement une copie.

AppForge Studio inclut le SDK dans le paquet Android et propose son téléchargement depuis Cloud & synchronisation. Les prompts AppForge et PromptiPro indiquent désormais aux nouveaux projets de brancher ce module aux adaptateurs de données métier.

## Contrôles exécutés

- npm run test:cloud : 3 tests réussis, dont activation sans données de compte, choix lors d’une sauvegarde Cloud existante et conflit entre deux copies.
- npm run build : réussi; le module SDK et son guide sont copiés vers dist/cloud/license-worker/.
- node --check : Worker, SDK, script de build et 9 scripts inline vérifiés sans erreur.
- git diff --check : réussi.
- Android : versionCode 164 configuré. La CI doit produire l’APK 15.8.4 et lancer le contrôle d’ouverture Android 13 après ce push.

## Limite de mise en production

Le code et les tests locaux ne prouvent pas le déploiement Cloudflare. Il faut appliquer la migration D1 0006, déployer le Worker avec ses secrets déjà configurés côté Cloudflare, puis tester une activation payée, le renouvellement, la révocation et une synchronisation réelle. Tant que ces étapes ne sont pas confirmées, l’accès automatique est prêt dans le code, mais n’est pas attesté en production. La page de sauvegarde interne d’AppForge Studio conserve une session propriétaire et une organisation; ce parcours distinct n’est pas montré aux clients des applications licenciées.
