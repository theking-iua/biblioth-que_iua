# PMB IUA v2 : bibliothèque de l'Institut Universitaire d'Abidjan

Le site unique (React + PHP + MySQL) est remplacé par **quatre projets** qui partagent la même base de données :

| Dossier | Rôle | Pour qui | Technologie | Port (dev) |
|---|---|---|---|---|
| `api/` | API REST : toutes les règles de prêt, réservations, retards… | — | Node.js 22 + Express + PostgreSQL **Neon** | 4000 |
| `admin/` | Espace d'administration (ordinateur) | Bibliothécaires, administrateurs | React 18 + Vite + Tailwind | 5173 |
| `mobile/` | Appli mobile installable (PWA) | Étudiants, lecteurs, visiteurs | React 18 + Vite + Tailwind | 5174 |
| `etudiant/` | **Appli Android (APK) / iOS** | Étudiants, lecteurs, visiteurs | React Native + Expo SDK 58 | — |

> **APK Android** : voir [`etudiant/README.md`](etudiant/README.md). En bref : dépôt GitHub → Actions → « APK Android (appli étudiant) » → Run workflow.

```
            ┌──────────────┐        ┌──────────────┐
            │  admin/      │        │  mobile/     │
            │  (personnel) │        │  (lecteurs)  │
            └──────┬───────┘        └──────┬───────┘
                   │  HTTPS + JSON (jeton JWT)│
                   └───────────┬────────────┘
                        ┌──────▼──────┐
                        │   api/      │  Node.js / Express
                        └──────┬──────┘
                        ┌──────▼──────┐
                        │    Neon     │  PostgreSQL
                        └─────────────┘
```

- L'appli **admin** refuse les comptes lecteurs (et leur propose l'appli mobile).
- L'appli **mobile** est faite pour le téléphone : barre d'onglets, carte de lecteur avec QR code, installable sur l'écran d'accueil, s'ouvre même sans réseau.
- Les deux applis parlent à la **même API** ; les rôles sont vérifiés côté serveur à chaque requête.

---

## 1. Créer la base Neon (5 minutes)

1. Créez un compte sur <https://neon.tech> puis un projet (région la plus proche : *AWS Europe (Frankfurt)*).
2. Bouton **Connect** → copiez la *connection string* (elle se termine par `?sslmode=require`).
3. Dans `api/`, copiez `.env.example` en `.env` et collez-la dans `DATABASE_URL`.
4. Générez un secret pour les sessions et collez-le dans `JWT_SECRET` :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

## 2. Lancer en local

Prérequis : **Node.js 22** ou plus récent.

```bash
npm run install:all        # installe les 3 projets
npm run db:init            # crée les tables + référentiels + compte admin
#   ou : npm run db:demo   # idem + 12 ouvrages et 2 comptes de démonstration
npm run dev                # lance l'API, l'admin et le mobile ensemble
```

- Admin : <http://localhost:5173> (compte `iuapmb@iua.ci`, mot de passe `iuabibliotheque` ou celui défini par `ADMIN_PASSWORD`)
- Mobile : <http://localhost:5174> (avec `db:demo` : `adherent@iua.ci` / `iuabibliotheque`)
- Sur un téléphone du même Wi-Fi : `http://<IP-du-PC>:5174` (ajoutez cette adresse à `CORS_ORIGINS`).

> ⚠ Changez le mot de passe administrateur par défaut dès la première connexion.

## 3 bis. Reprendre les données de l'ancien **PMB** (livres, lecteurs, prêts)

Voir **[REPRISE-PMB.md](REPRISE-PMB.md)** : `npm --prefix api run import:pmb -- --mysql "mysql://root:@localhost:3306/bibli"`.

## 3. Reprendre les données de l'ancien site React/PHP (MySQL/XAMPP)

Les lecteurs, prêts, réservations, historique, mémoires et mots de passe sont repris tels quels (les anciens mots de passe PHP restent valables).

```bash
cd api
npm install mysql2
# dans api/.env : MYSQL_URL=mysql://root:@127.0.0.1:3306/iua_pmp   (XAMPP démarré)
npm run migrate:mysql      # à lancer sur une base Neon VIDE, avant db:init
```

Copiez ensuite l'ancien dossier `backend/uploads/` dans `api/uploads/` pour garder les photos et les PDF.

## 4. Mettre en ligne

**API** (Render, Railway, un VPS…). Avec Render : *New → Blueprint* sur ce dépôt (fichier `render.yaml` fourni), puis renseignez :
- `DATABASE_URL` (Neon), `CORS_ORIGINS` (les URL des deux applis, séparées par des virgules), `PUBLIC_BASE_URL` (`https://<api>/api`).
- Les photos et PDF sont enregistrés sur disque (`UPLOAD_DIR`) : gardez un disque persistant (prévu dans `render.yaml`), sinon ils disparaissent à chaque redéploiement.

**Applis admin et mobile** (Vercel, Netlify, Render Static Site…) : dossier racine `admin/` ou `mobile/`, commande `npm run build`, dossier publié `dist/`. Variables :
- admin : `VITE_API_URL=https://<api>/api`, `VITE_MOBILE_URL=https://<appli mobile>`
- mobile : `VITE_API_URL=https://<api>/api`, `VITE_ADMIN_URL=https://<appli admin>`

Les fichiers de redirection (`vercel.json`, `public/_redirects`) sont déjà présents. L'appli mobile doit être servie en **HTTPS** pour être installable.

## 5. Tâches planifiées

Chaque nuit : passage des prêts en retard, suspension automatique au-delà de `jours_retard_suspension`, expiration des réservations non retirées.
- Intégré au serveur avec `CRON_ENABLED=true` (heure : `CRON_HOUR`, 2 h par défaut).
- Ou en externe : `npm --prefix api run cron` (Planificateur de tâches Windows, crontab, *Render Cron Job*).
- Ou à la main : bouton « Lancer le traitement des retards » dans *Paramètres* (admin).

## 6. Import des étudiants

CSV avec en-tête `nom;prenom;matricule;filiere;email;telephone` (accents Excel gérés). Mot de passe initial = matricule.
Depuis *Adhérents → Importer CSV* dans l'admin, ou en ligne de commande pour les gros fichiers :
```bash
npm --prefix api run import:lecteurs -- C:\chemin\etudiants.csv
```

## 7. Connexion Microsoft 365 (facultatif)

Enregistrez l'application dans Entra ID avec **deux** URI de redirection (flux « ID token ») : `https://<admin>/sso-callback` et `https://<mobile>/sso-callback`, puis dans `api/.env` : `SSO_ENABLED=true`, `SSO_CLIENT_ID`, `SSO_TENANT_ID`.

## 8. Tests

```bash
cd api
# sur une base de TEST initialisée avec db:demo, API démarrée :
npm test     # 13 scénarios : prêts, réservations, retards, quotas, droits, fichiers, import…
```
⚠ Ne lancez jamais les tests sur la base de production : ils créent des données.

---

## Correspondance ancien → nouveau

| Ancien (PHP) | Nouveau (Node) |
|---|---|
| `login.php` | `POST /api/login` |
| `sso_callback.php` | `GET/POST /api/sso` |
| `members.php` | `/api/members` |
| `admin_users.php` | `/api/admin-users` |
| `catalogue.php`, `copies.php` | `/api/catalogue`, `/api/copies` |
| `loans.php`, `renewals.php` | `/api/loans`, `POST /api/renewals` |
| `borrow_requests.php` | `/api/borrow-requests` (+ `DELETE` : le lecteur annule sa demande) |
| `reservations.php`, `favorites.php`, `notifications.php` | `/api/reservations`, `/api/favorites`, `/api/notifications` |
| `taxonomies.php`, `digital_resources.php` | `/api/taxonomies`, `/api/digital-resources` |
| `settings.php`, `cron_penalties.php` | `/api/settings`, `POST /api/daily-processing` |
| `dashboard_stats.php`, `realtime_alerts.php`, `activity_logs.php` | `/api/dashboard-stats`, `/api/realtime-alerts`, `/api/activity-logs` |
| `photo_upload.php`, `upload_memoire.php`, `import_lecteurs.php` | `/api/photo-upload`, `/api/upload-memoire`, `/api/import-lecteurs` |
| — | `GET /api/me`, `GET /api/health` |

Les paramètres (`?id=`, `?q=`…) et les réponses JSON sont identiques, ce qui a permis de reprendre les écrans du personnel sans les réécrire.

## Ce qui a changé au passage

- **Recherche sans accents** : « securite » trouve « Sécurité », « kone » trouve « Koné ».
- **QR code de la carte de lecteur** généré sur le téléphone (avant : envoyé à un service externe) ; il contient le matricule, lisible par la douchette dans le *Prêt rapide*.
- **Levée automatique de la suspension** au retour des livres en retard : la condition de l'ancien code ne se déclenchait jamais, elle est corrigée.
- **Réservations simultanées** : verrou pour que deux lecteurs n'obtiennent pas le même rang.
- **Dates** à l'heure d'Abidjan quelle que soit la région Neon (`APP_TIMEZONE`).
- Nouveau : un lecteur peut annuler sa propre demande d'emprunt depuis l'appli.
