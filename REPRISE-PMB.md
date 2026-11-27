# Reprendre les données de l'ancien PMB dans la nouvelle base (Neon)

## D'abord : où sont vos données ?

Le dossier `www` (`PMBTL`, `PMBTLi`) ne contient que **le programme PMB**. Les livres, exemplaires, lecteurs et prêts sont dans le serveur **MySQL** de WAMP (ou XAMPP / EasyPHP), dans deux bases :

| Installation | Base MySQL |
|---|---|
| `www/PMBTL`  | **`biblio`** |
| `www/PMBTLi` | **`bibli`**  |

La reprise lit directement ces bases. Si les deux installations ont été utilisées, reprenez les deux : les doublons de lecteurs (même email ou même code-barres) sont fusionnés automatiquement.

## Ce qui est repris

| Ancien PMB | Nouveau SIGB |
|---|---|
| Notices (titre + complément, auteurs, éditeur, année, ISBN, pages, résumé, mots-clés, langue, catégorie ou indexation Dewey, vignette) | Catalogue |
| Numéros de revues (bulletins) ayant des exemplaires | Catalogue (type « revue ») |
| Exemplaires (code-barres, cote, localisation + section, statut : empruntable, perdu/pilon, en réparation/consultation sur place) | Exemplaires |
| Lecteurs (nom, prénom, email, téléphone, code-barres → matricule, profession ou catégorie → filière, statut « interdit » → suspendu) | Lecteurs |
| **Mot de passe du portail PMB** | Chiffré (bcrypt) : chaque lecteur garde son ancien mot de passe. Sans mot de passe : son code-barres. |
| Prêts en cours (dates, prolongations) | Prêts en cours / en retard |
| Historique des prêts | Prêts « rendus » |
| Réservations (file d'attente, exemplaire mis de côté) | Réservations |
| Documents numériques (liens, fichiers PDF/EPUB stockés en base ou sur disque) | « Ouvrir la version numérique » sur la fiche |
| Notices de mémoires et thèses | Catalogue **et** onglet « Mémoires » |
| Auteurs, éditeurs, localisations, catégories | Référentiels |

Non repris : les dépouillements d'articles de revues (le numéro de revue est repris), les paniers, les abonnements DSI, les suggestions, la comptabilité des acquisitions, les paramètres de PMB.

## Méthode 1 : vous lancez la reprise (sur le PC où tourne PMB)

Prérequis : WAMP démarré (icône verte), **Node.js 22** installé, le projet `pmb-iua` décompressé, et `api/.env` rempli avec la chaîne de connexion **Neon** (`DATABASE_URL`).

Ouvrez un terminal (**Windows + R**, tapez `cmd`) :

```bat
cd C:\chemin\vers\pmb-iua\api
npm install
npm run db:init

:: 1) Essai : tout est calculé, le bilan s'affiche, RIEN n'est enregistré
npm run import:pmb -- --mysql "mysql://root:@localhost:3306/bibli" --fichiers "C:\wamp\www\PMBTLi" --essai

:: 2) Si le bilan vous convient : reprise réelle
npm run import:pmb -- --mysql "mysql://root:@localhost:3306/bibli" --fichiers "C:\wamp\www\PMBTLi"

:: 3) Puis la deuxième base, si elle a été utilisée
npm run import:pmb -- --mysql "mysql://root:@localhost:3306/biblio" --fichiers "C:\wamp\www\PMBTL"
```

- `root:` = utilisateur `root` sans mot de passe (WAMP par défaut). Avec un mot de passe : `mysql://root:MOTDEPASSE@localhost:3306/bibli`.
- `--fichiers` : dossier de l'ancien PMB, pour retrouver les documents numériques enregistrés sur le disque (les PDF sont copiés dans `api/uploads/documents/`, à mettre en ligne avec l'API).
- `--sans-historique` : ne pas reprendre les prêts rendus.
- On peut relancer la reprise sans risque : ce qui a déjà été repris est ignoré (table `pmb_import_map`). Tout se fait dans une seule transaction : en cas d'erreur, rien n'est enregistré.

Exemple de bilan :

```
================ Bilan de la reprise PMB ================
Base PMB : bibli
  Notices importées ............ 4 812
  Exemplaires .................. 7 950
  Lecteurs créés ............... 2 304
  Prêts en cours ............... 187
  Historique des prêts ......... 15 422
  …
  ⚠ 63 prêt(s) repris sont en retard au-delà du seuil de suspension (41 lecteur(s)) …
```

## Méthode 2 : vous m'envoyez l'export, je fais la reprise

1. Ouvrez **phpMyAdmin** : `http://localhost/phpmyadmin`.
2. Cliquez à gauche sur la base **`bibli`**, onglet **Exporter**, méthode « Rapide », format **SQL**, **Exécuter**.
3. Recommencez avec **`biblio`**.
4. Envoyez les fichiers `.sql` (compressés en .zip s'ils sont gros), ainsi que les dossiers de documents numériques s'il y en a.

Je vous rendrai un fichier prêt à charger dans Neon, avec le bilan complet.

> Si phpMyAdmin ne s'ouvre pas mais que vous avez le dossier `C:\wamp\bin\mysql\mysql5.x\data\bibli`, envoyez ce dossier (WAMP arrêté) : on peut aussi en extraire les données.

## Après la reprise : à vérifier avant d'activer le traitement de nuit

1. **Prêts en retard depuis longtemps** : PMB contient souvent des prêts jamais clôturés. Le traitement de nuit suspend automatiquement les lecteurs en retard au-delà de `jours_retard_suspension` (10 jours par défaut). Ouvrez la page **Retards** de l'admin, enregistrez les retours ou passez les exemplaires en « perdu », **puis** activez `CRON_ENABLED=true`.
2. **Lecteurs sans email** : ils reçoivent une adresse technique `pmb-…@sans-email.invalid` et se connectent avec leur **code-barres PMB**. Complétez leur email depuis l'admin (Adhérents).
3. **Catégories** : les domaines viennent des catégories PMB (ou de l'indexation Dewey). Regroupez-les si besoin dans *Référentiels*.
4. Le **journal d'activité** (admin → Journal) garde une ligne « Reprise des données PMB » avec le bilan et la liste des éléments non repris.
