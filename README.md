# AppForge Studio Android

Application Android emballant AppForge Studio 15.8.3 dans Capacitor. Le générateur de cahier des charges est livré dans PromptiPro.html, application HTML autonome distincte, et les projets sélectionnés sont transmis à PromptiPro. Les applications clientes restent offline-first; une licence ou un essai valides reçoivent un accès Cloud signé sans création obligatoire de compte e-mail/mot de passe.

## Licence et Cloud

Le Worker de licences et de synchronisation se trouve dans `cloud/license-worker/`. La migration 0006 ajoute les instantanés Cloud. Après activation ou démarrage d’essai, le Worker délivre un jeton d’accès Cloud de six heures. Les routes `GET/PUT /v1/cloud/snapshot?resource=...` vérifient de nouveau la licence et l’appareil; `PUT` exige `expectedRevision`, et renvoie HTTP 409 en cas de conflit. Les instantanés sont limités à 450 Ko et ne sont pas chiffrés de bout en bout. Le code source et l’ID D1 ne prouvent pas un déploiement : appliquer la migration puis déployer le Worker séparément.

L’application Android utilise biométrie forte avec code de verrouillage système en secours. Le coffre existant est chiffré par AES-GCM/PBKDF2 et son enveloppe est conservée dans Android Keystore. Le partage/restauration passe par les activités Android natives et fonctionne avec Google Drive via le sélecteur système, sans OAuth intégré. La version HTML standalone ne dispose pas du Keystore Android.

## Ouvrir dans Android Studio

1. Installer Node.js 22, JDK 21 et Android SDK 35.
2. Dans le dossier du projet, exécuter `npm ci`.
3. Exécuter `npm run sync`.
4. Ouvrir le dossier `android/` dans Android Studio.

## Construire

`npm run sync` prépare les ressources web puis les synchronise dans Android.
`cd android && ./gradlew assembleApi23Debug` construit la variante de diagnostic.
Les variantes API 23 et API 29 signées sont construites par GitHub Actions.

## Signature

La clé de publication existante est fournie uniquement par les secrets GitHub `KEYSTORE_BASE64`, `KEY_ALIAS`, `KEYSTORE_PASSWORD` et `KEY_PASSWORD`. Aucun fichier de clé ou mot de passe ne doit être ajouté au dépôt.
