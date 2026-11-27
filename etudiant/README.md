# Biblio IUA : appli étudiant (React Native + Expo)

Application Android (et iOS) des lecteurs de la bibliothèque de l'IUA. Elle utilise la même API que l'appli admin (`../api`).

**Écrans** : accueil (prêts en cours avec compte à rebours, réservation à retirer, nouveautés, domaines), catalogue avec filtres, fiche livre (demander l'emprunt, réserver, favori, partager), mémoires et thèses (lecture du PDF), mes prêts (prolonger, annuler une demande ou une réservation, livres rendus), profil (photo, informations, mot de passe, apparence), carte de lecteur avec QR code (fonctionne sans réseau), notifications, favoris, réglage de l'adresse du serveur.

**Propre au téléphone** : rappels locaux 2 jours avant la date de retour et le jour même à 9 h (désactivables dans Profil), session dans le coffre chiffré du téléphone, « tirer pour actualiser », thème clair/sombre.

---

## Obtenir l'APK

### Option A : GitHub Actions (gratuit, sans compte Expo) — recommandé

1. Mettez le dossier `pmb-iua/` dans un dépôt GitHub (le fichier `.github/workflows/apk-etudiant.yml` doit être à la racine du dépôt).
2. Sur GitHub : **Actions** → **APK Android (appli étudiant)** → **Run workflow**, saisissez l'adresse de votre API (ex. `https://api.biblio.iua.ci/api`).
3. Environ 15 minutes plus tard, l'APK `biblio-iua-1.0.0.apk` est téléchargeable en bas de la page du build (**Artifacts**).

Pour publier une version : `git tag etudiant-v1.0.0 && git push --tags` (l'APK apparaît aussi dans **Releases**).

### Option B : EAS Build (serveurs d'Expo, compte gratuit)

```bash
cd etudiant
npm install
npx eas-cli@latest login          # compte gratuit sur expo.dev
npx eas-cli@latest build -p android --profile preview
```
Changez d'abord `EXPO_PUBLIC_API_URL` dans `eas.json`. EAS donne un lien et un QR code pour installer l'APK.

### Option C : sur votre PC (Android Studio installé, JDK 17)

```bash
cd etudiant
npm install
set EXPO_PUBLIC_API_URL=https://api.biblio.iua.ci/api      (Windows ; sous macOS/Linux : export …)
npm run build:apk:local
```
APK : `etudiant/android/app/build/outputs/apk/release/app-release.apk`

### Installer l'APK sur un téléphone

Copiez le fichier sur le téléphone (WhatsApp, câble, Drive…), ouvrez-le et autorisez « Installer des applis inconnues » quand Android le demande.

> L'APK est signé avec la clé de développement d'Expo : parfait pour une diffusion interne (les mises à jour s'installent par-dessus). Pour le **Play Store**, utilisez `eas build -p android --profile production` (fichier .aab, clé de signature gérée par EAS).

---

## Adresse du serveur (API)

- Fixée au moment du build par `EXPO_PUBLIC_API_URL`.
- Modifiable dans l'appli : **Profil → Serveur** (avec bouton « Tester la connexion »). Pratique pour essayer l'APK sur le Wi-Fi de la bibliothèque avant la mise en ligne : `http://<IP-du-PC>:4000/api`.
- Le HTTP simple est autorisé pour ces essais en réseau local ; en production, utilisez une adresse **https**.

## Développer

```bash
npm install
npm start          # puis touchez « a » pour un émulateur Android, ou scannez le QR code avec Expo Go
npm run lint
```
Créez un fichier `.env` avec `EXPO_PUBLIC_API_URL=http://<IP-du-PC>:4000/api` (le téléphone ne voit pas « localhost »).

## Structure

```
src/app/            écrans (Expo Router : un fichier = une page)
  (tabs)/           Accueil, Catalogue, Mémoires, Mes prêts, Profil
  livre/[id].jsx    fiche d'un ouvrage
  carte, notifications, favoris, connexion, inscription, profil-modifier, mot-de-passe, serveur
src/components/     interface commune (boutons, champs, couvertures de livres…)
src/lib/            API, stockage sécurisé, rappels, thème, dates
assets/             icônes Android (adaptative + monochrome) et écran de démarrage
```

Le dossier `android/` est généré par `expo prebuild` : ne le modifiez pas, changez `app.json` à la place.
