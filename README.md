# AppForge Studio Android

Application Android emballant AppForge Studio 15.8 dans Capacitor. PromptiPro est une application HTML autonome distincte (PromptiPro.html), accessible indépendamment. Les règles AppForge imposent que toute licence active donne automatiquement accès au Cloud client sans création obligatoire de compte e-mail/mot de passe; les applications restent offline-first. L’interface et les données restent locales sur l’appareil ; la page Cloud utilise le Worker Cloudflare configuré dans AppForge.

## Licence et Cloud

Le source du Worker de licences se trouve dans `cloud/license-worker/`. La migration 0005 ajoute la modification/suppression non destructive des applications et licences. Ce dépôt contient le code; un déploiement Cloudflare doit être effectué séparément pour que ces routes soient actives.

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
