# AppForge Studio Ultimate 15.8.13

- Sécurise la migration Business Manager : validation des sources, conservation des clés historiques, rattachement des dossiers par ID, recréation des projets manquants et confirmation de l’écriture avant de marquer la migration terminée.
- En cas de données illisibles ou de stockage indisponible, la migration s’arrête sans effacer les sources ni marquer la migration comme terminée.
- La restauration D1 fusionne les enregistrements par identifiant ; les éléments distants absents sont ajoutés et les valeurs locales restent prioritaires en cas de conflit.
- Avant la fusion, conserve une copie brute des deux stockages locaux et l’instantané Cloud d’origine dans IndexedDB. Une écriture partielle est annulée lorsque le retour arrière est possible.
- La restauration d’un seul ensemble D1 ne dépend plus de la présence de l’autre ensemble.
- Les déclarations historiques de paiement sans statut explicite « Vérifié manuellement » ne sont plus comptabilisées comme encaissées.
- Une migration ou fusion locale désactive la synchronisation automatique jusqu’à vérification et sauvegarde volontaire.
- Ajoute des tests de migration, fusion, conflits, erreurs de stockage et paiement ; le workflow exécute désormais également les tests du Worker R2.
- Android : versionCode 174, versionName 15.8.13. Les APK Release API23 et API29 sont publiés comme deux artefacts GitHub distincts, en plus de l’archive combinée.
