// Initialise (ou met à niveau) la base Neon : schéma, données de référence, comptes par défaut.
//   npm run db:init          → schéma + référentiels + comptes
//   npm run db:demo          → idem + quelques ouvrages de démonstration (si le catalogue est vide)
// Idempotent : peut être relancé sans risque.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool, db } from "../src/db.js";
import { config } from "../src/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlFile = (name) => fs.readFile(path.join(here, "..", "db", name), "utf8");

if (!config.databaseUrl) {
  console.error("DATABASE_URL manquant : copiez api/.env.example en api/.env et collez la chaîne de connexion Neon.");
  process.exit(1);
}
if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(config.timezone)) {
  console.error(`APP_TIMEZONE invalide : ${config.timezone}`);
  process.exit(1);
}

try {
  const schema = (await sqlFile("schema.sql")).replaceAll("__APP_TIMEZONE__", config.timezone);
  await pool.query(schema);
  console.log("✔ Schéma à jour");

  await pool.query(await sqlFile("seed.sql"));
  console.log("✔ Paramètres, catégories, localisations et mémoires d'exemple");

  // Comptes par défaut (créés seulement s'ils n'existent pas)
  const adminEmail = (process.env.ADMIN_EMAIL || "iuapmb@iua.ci").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "iuabibliotheque";
  const created = await db.run(
    `INSERT INTO users (nom, email, mot_de_passe, role) VALUES ('Administrateur IUA', ?, ?, 'admin')
     ON CONFLICT ((lower(email))) DO NOTHING`,
    [adminEmail, await bcrypt.hash(adminPassword, 10)]
  );
  if (created) {
    console.log(`✔ Compte administrateur créé : ${adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) console.warn("  ⚠ Mot de passe par défaut « iuabibliotheque » : changez-le dès la première connexion.");
  }

  if (process.argv.includes("--demo")) {
    await db.run(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role, telephone, matricule, filiere)
       VALUES ('Kouassi', 'Yao Emmanuel', 'adherent@iua.ci', ?, 'adherent', '+225 07 00 11 22 33', 'IUA-2024-0482', 'Master 2 Génie Logiciel')
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [await bcrypt.hash("iuabibliotheque", 10)]
    );
    await db.run(
      `INSERT INTO users (nom, prenom, email, mot_de_passe, role)
       VALUES ('Diabaté', 'Awa', 'bibliothecaire@iua.ci', ?, 'bibliothecaire')
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [await bcrypt.hash("iuabibliotheque", 10)]
    );
    await pool.query(await sqlFile("seed_demo.sql"));
    console.log("✔ Données de démonstration (lecteur adherent@iua.ci, bibliothécaire bibliothecaire@iua.ci — mot de passe iuabibliotheque)");
  }
  console.log("Base prête.");
} catch (e) {
  console.error("✘ Échec de l'initialisation :", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
