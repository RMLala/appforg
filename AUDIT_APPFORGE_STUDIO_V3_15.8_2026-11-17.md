# AppForge Studio 15.8 — audit V3

Date : 17 novembre 2026  
Base auditée : main au commit cabe5a874cd1acbfe179bb08cd7df6ab09e916d4 (15.8.0).  
Référentiel : RMLala/android-template/APPFORGE-STANDARD-V3.md.

## Résumé

La compilation Android de main a réussi dans GitHub Actions run 44050072935. Elle a publié un APK Debug API 23 et deux APK Release signés, API 23 et API 29. Cela valide le packaging de ce commit, pas les fonctions de sécurité, licence ou synchronisation.

Cette branche ajoute la page « À propos & Support » et corrige la règle Google Drive dans les règles de génération. Aucun build PWA n’est présent.

## Conformité vérifiable

| Exigence | État | Preuve / limite |
|---|---|---|
| Thèmes, navigation, mobile | Présent | Sélecteur de thèmes, onglets responsive et règles mobiles dans le HTML. |
| Logo AppForge | Présent, source à confirmer | Image raster intégrée au CSS; résolution et provenance originale non auditées. |
| PromptiPro séparé | Partiel | PromptiPro.html existe et la bibliothèque intégrée a été retirée. Générateur avancé et génération guidée restent dans AppForge. |
| Coffre PIN 4 chiffres | Réserve sécurité | PBKDF2 310000 itérations et AES-GCM 256 bits dans localStorage. Pas de limite persistante d’essais ni de clé Android Keystore; un PIN offre un espace restreint à une attaque hors ligne. |
| Biométrie prioritaire / PIN de secours | Absent | Aucun plugin ou appel biométrique natif dans les dépendances/code audités. |
| Paramètres de connexion | Partiel | Jeton administrateur en mémoire; paramètres peuvent être conservés dans le coffre chiffré. Aucun déverrouillage biométrique. |
| Import/export, recherche et tri licences | Présent | Filtrage, tri, export CSV/Excel XML/XLSX et import CSV/XLSX. |
| Licences | Présent côté Worker | Essai par défaut 72 h, mensuel, annuel, à vie, propriétaire; appareils, expiration, statut et révocation. L’essai dépend d’un identifiant d’installation client et l’anti-réinstallation n’est pas prouvé. |
| Licence active → Cloud client automatique | Absent / non démontré | /v1/activate retourne une preuve de licence; pas d’identité/jeton Cloud lié à la licence. |
| Synchronisation Cloudflare/D1 | Partielle | Instantané Studio versionné et session propriétaire. Le protocole remplace tout l’instantané et signale la révision concurrente; aucune fusion par enregistrement ni preuve de déploiement Cloudflare. |
| Drive sans OAuth | Absent dans main | JSON local présent; aucun partage natif Android ni restauration via sélecteur. La règle générée est corrigée sur cette branche, mais cela ne crée pas le code natif. |
| À propos & Support | Ajout sur cette branche | États disponibles, aide, confidentialité, conditions, mentions et diagnostic préparé localement. E-mail envoyé uniquement après action explicite. Vérification GitHub liée aux releases publiées. |
| APK Debug/API23 et Release/API23/API29 | Vérifié sur main | Run #26 réussi; artefacts non expirés; le workflow lance apksigner verify --print-certs pour les deux Releases. |
| HTML/EXE portable | Non sélectionnés | Aucun HTML/EXE distinct généré par le workflow Android. |
| PWA | Conforme à l’exclusion | Aucun manifeste ou service worker dans l’arborescence auditée. |

## À réaliser avant « Finalisé »

1. Biométrie native prioritaire, PIN secours, clé de coffre Android Keystore; définir le comportement HTML autonome.
2. Liaison réelle licence → droit Cloud client et synchronisation automatique sans compte e-mail/mot de passe obligatoire; tester révocation, hors ligne, appareils et conflits.
3. Partage Android natif vers Drive, sélecteur de fichier, intégrité et confirmation de restauration.
4. Décider si la génération de spécifications applicatives reste dans AppForge ou est retirée au profit de PromptiPro. Sa suppression retire le parcours principal actuel et nécessite une validation produit.
5. Tester ces parcours sur un appareil Android réel; une compilation CI ne les valide pas.

## Preuves Android existantes

- Run : https://github.com/RMLala/appforg/actions/runs/44050072935 — commit cabe5a87.
- Debug API23 : https://github.com/RMLala/appforg/actions/runs/44050072935/artifacts/14313082867.
- Release signé API23 + API29 : https://github.com/RMLala/appforg/actions/runs/44050072935/artifacts/14313551347.
- Ces artefacts correspondent au dernier main audité. L’artefact du commit 2500fdee, antérieur, n’est pas utilisé comme preuve actuelle.

## Trois actions prioritaires

1. Valider le retrait du générateur et le parcours de déverrouillage natif.
2. Construire le provisionnement Cloud lié aux licences et intégrer un client pilote.
3. Implémenter puis vérifier partage/restauration Drive sur appareil Android.
