# AppForge Studio Ultimate 15.8.14

## Corrections fonctionnelles
- Réactive le chargement initial des dossiers et du tableau de bord après suppression de l’ancien verrou Business Manager.
- Recharge l’état commun à chaque retour dans Business Manager afin d’éviter d’écraser les projets modifiés depuis les autres rubriques Studio.
- Après validation de la relecture, le dossier sauvegardé est également rechargé en mémoire avec son identifiant de projet Studio.
- Corrige la sauvegarde Business Manager : la vérification relit désormais les dossiers depuis le stockage commun AppForge Studio, et non depuis l’ancienne clé locale.
- Corrige l’affichage des messages de validation et d’erreur dans le composant Business Manager intégré au Shadow DOM.
- La suppression d’un dossier est répercutée dans la liste de projets Studio ; un dossier supprimé ne doit plus réapparaître après redémarrage.
- L’import JSON et la restauration chiffrée passent par le stockage commun Studio, avec vérification après écriture et retour arrière lorsque possible.
- Les onglets du projet sont liés au dossier sélectionné ; l’onglet Commercial est masqué pour les projets personnels.

- Si la lecture du stockage échoue, les modifications, suppressions et mises à jour du catalogue sont bloquées et un message visible prévient l’utilisateur au lieu de risquer une réécriture vide.

## Version Android
- versionName : 15.8.14
- versionCode : 175
- APK Release API23 et API29 à reconstruire et retester après validation CI.

## Limites toujours ouvertes
- L’interface d’envoi de pièces jointes R2, les noms de fichiers d’origine, leur rattachement au projet et l’affichage des quotas R2 ne sont pas encore livrés.
- Le test fonctionnel exhaustif de tous les boutons reste à compléter ; les tests automatisés ciblent les régressions identifiées.
- Le retour physique Android doit encore être validé sur appareil réel.
