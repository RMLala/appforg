# AppForge Studio Android

Application Android emballant AppForge Studio 15.5 dans Capacitor. L’interface et les données restent locales sur l’appareil ; la page Cloud utilise le Worker Cloudflare configuré dans AppForge.

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
