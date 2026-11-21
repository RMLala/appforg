# AppForge Studio Ultimate 15.8.11

- Business Manager est monté dans la navigation et le shell existants d’AppForge Studio, sans iframe ni page HTML autonome dans le bundle Android.
- Les données Business Manager historiques sont migrées sans suppression vers les fiches projet conservées dans l’état Studio.
- Le questionnaire et les rubriques projet sont reliés à la fiche commune; l’accès Licence et Cloud renvoie aux pages Studio partagées.
- Le calcul du solde de facture ne retient que les paiements dont la validation manuelle est enregistrée.
- Le questionnaire et le générateur Studio restent accessibles dans AppForge Studio.
- Android versionCode : 172.
- Les licences du projet affichent les émissions et droits Cloud lus avec la session Studio, sans inventer un état serveur.
- « Licence & Cloud » permet de choisir les données D1 et pièces jointes R2, vérifie l’empreinte SHA-256 et enregistre une copie locale avant restauration. Les noms et liens de projet des fichiers restent ceux que le Worker expose (ID opaque).
