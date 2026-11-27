# PMB IUA Administration : application Windows

L'espace d'administration (bibliothécaires et administrateurs) en **application de bureau Windows**, avec icône sur le Bureau et dans le menu Démarrer. C'est le même espace admin que la version web (dossier `../admin`), embarqué dans Electron.

## Installer sur un ordinateur

1. Copiez `PMB-IUA-Administration-Setup-2.0.0.exe` sur le PC (clé USB, réseau, Drive…) et double-cliquez dessus.
2. **Windows SmartScreen** affiche « Windows a protégé votre ordinateur », car l'installateur n'est pas signé par un certificat payant. Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
3. Suivez l'assistant (en français). Aucun droit d'administrateur n'est demandé : l'appli s'installe pour l'utilisateur Windows en cours, dans `%LOCALAPPDATA%\Programs\PMB IUA Administration`.
4. Au premier lancement, indiquez l'**adresse du serveur** (l'API, terminée par `/api`), cliquez sur **Tester la connexion**, puis sur **Enregistrer**.

Pour changer de serveur plus tard : menu **Fichier → Serveur de la bibliothèque…** (Ctrl+,).

## Installer sur plusieurs postes

```bat
PMB-IUA-Administration-Setup-2.0.0.exe /S
"%LOCALAPPDATA%\Programs\PMB IUA Administration\PMB IUA Administration.exe" --serveur=https://api.biblio.iua.ci/api
```
`/S` installe sans fenêtre. `--serveur=` enregistre l'adresse du serveur, sans saisie au premier lancement.

## Mettre à jour, désinstaller

- **Mise à jour** : lancez le nouvel installateur. Il ferme l'appli, remplace les fichiers et conserve le réglage du serveur.
- **Désinstallation** : Paramètres Windows → Applications → Applications installées → *PMB IUA Administration* → Désinstaller.
- Réglages enregistrés dans `%APPDATA%\PMB IUA Administration\config.json` (conservés après désinstallation, pour une réinstallation).

## Côté serveur

L'appli se présente à l'API avec l'origine `app://admin`. Elle est autorisée par défaut. Si vous avez défini `CORS_ORIGINS` dans `api/.env`, ajoutez-y `app://admin`. L'appli fonctionne aussi sans cet ajout, mais c'est plus propre.

La connexion Microsoft 365 n'est pas proposée dans l'appli de bureau : Microsoft ne peut pas rediriger vers une appli installée. Elle reste disponible dans la version web.

## Fabriquer l'installateur

| Depuis | Commande |
|---|---|
| Windows (Node 22 + [NSIS](https://nsis.sourceforge.io/Download)) | `npm install` puis `npm run dist` |
| Linux / macOS (Node 22 + `nsis` / `makensis`) | `npm install` puis `npm run dist` |
| GitHub | onglet **Actions** → **Installateur Windows (admin)** → **Run workflow** |

Résultat : `release/PMB-IUA-Administration-Setup-<version>.exe`. Pour une nouvelle version, changez `"version"` dans `package.json`.

`npm start` lance l'appli sans l'installer (pour tester).

## Ce que fait l'appli

- Interface servie depuis l'application (`app://admin`), sans serveur web local.
- Une seule instance à la fois. Taille et position de la fenêtre mémorisées.
- Liens externes (PDF des mémoires, appli des lecteurs, emails) ouverts dans le navigateur ou le logiciel par défaut.
- Menus en français : Fichier (serveur, imprimer), Édition, Affichage (zoom, plein écran, F5), Aide (à propos, diagnostic).
- Sécurité : la page n'a aucun accès à Windows (isolation de contexte, sandbox). Seul le réglage du serveur passe entre l'appli et la page.
