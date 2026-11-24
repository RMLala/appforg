# AppForge Studio Ultimate 15.8.15

## Cloud V3 / R2
- Ajoute l’envoi de pièces jointes vers le bucket R2 privé depuis Licence & Cloud.
- Ajoute le rattachement facultatif d’un fichier à un projet Studio.
- Conserve le nom d’origine, le type MIME, la taille, l’empreinte SHA-256 et l’identifiant du projet dans l’index D1 de la sauvegarde Studio.
- Affiche les quotas D1/R2 retournés par le Worker.
- Contrôle la révision attendue à chaque upload et vérifie le SHA-256 après téléchargement.
- Les fichiers restent isolés par produit, licence et installation ; le Worker ne reçoit aucun identifiant client sensible dans la clé R2.
- Les données locales restent conservées en cas de conflit ou d’échec de transfert.

## Version Android
- versionName : 15.8.15
- versionCode : 176

## Limites
- La suppression distante de fichiers R2 n’est pas exposée par le Worker client ; les pièces jointes envoyées ne peuvent pas encore être supprimées depuis l’interface.
- La recette réelle d’upload/download nécessite une licence/essai AppForge Studio actif et une validation sur appareil.
