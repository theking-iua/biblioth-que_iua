import fs from "node:fs";
import bcrypt from "bcryptjs";
const tz = "Africa/Abidjan";
const esc = (v) => (v === null || v === undefined || v === "" ? "NULL" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const schema = fs.readFileSync("db/schema.sql", "utf8").replaceAll("__APP_TIMEZONE__", tz);
const seed = fs.readFileSync("db/seed.sql", "utf8");
const livres = JSON.parse(fs.readFileSync("db/livres/livres.json", "utf8"));
const hash = bcrypt.hashSync("iuabibliotheque", 10);
let out = `-- =====================================================================
--  PMB IUA : initialisation de la base Neon (à coller dans le SQL Editor de console.neon.tech)
--  Crée les tables, les paramètres, les référentiels, le compte administrateur
--  et ajoute 4 livres numériques. Peut être relancé sans créer de doublons.
--  Généré le ${new Date().toISOString().slice(0, 10)}.
-- =====================================================================

${schema}

${seed}

-- ---------------------------------------------------------------- Compte administrateur
-- Email : iuapmb@iua.ci  /  mot de passe : iuabibliotheque  →  À CHANGER dès la première connexion
INSERT INTO users (nom, email, mot_de_passe, role)
VALUES ('Administrateur IUA', 'iuapmb@iua.ci', ${esc(hash)}, 'admin')
ON CONFLICT ((lower(email))) DO NOTHING;

-- ---------------------------------------------------------------- Livres récupérés de l'ancien PMB
-- Fichiers à copier sur le serveur de l'API, dans api/uploads/documents/ (voir fichiers-livres.zip)
`;
for (const l of livres) {
  const fichier = l.fichier && !l.protege ? `/uploads/documents/${l.fichier}` : null;
  const couv = l.couverture ? `/uploads/documents/${l.couverture}` : null;
  out += `
INSERT INTO categories (nom) VALUES (${esc(l.categorie)}) ON CONFLICT (nom) DO NOTHING;
INSERT INTO authors (nom) VALUES (${esc(l.auteur)}) ON CONFLICT (nom) DO NOTHING;
INSERT INTO publishers (nom) VALUES (${esc(l.editeur)}) ON CONFLICT (nom) DO NOTHING;
${l.localisation ? `INSERT INTO locations (nom) VALUES (${esc(l.localisation)}) ON CONFLICT (nom) DO NOTHING;\n` : ""}INSERT INTO documents (titre, auteur, editeur, annee, isbn, langue, categorie, cote, localisation, resume, mots_cles, type_document, nb_pages, couleur, couverture_url, fichier_numerique, disponible)
SELECT ${[l.titre, l.auteur, l.editeur, l.annee, l.isbn, l.langue || "Français", l.categorie, l.cote, l.localisation, l.resume, l.mots_cles, l.type_document || "livre", l.nb_pages, l.couleur, couv, fichier].map(esc).join(", ")}, 0
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE lower(titre) = lower(${esc(l.titre)}) AND lower(auteur) = lower(${esc(l.auteur)}));
`;
}
out += `
-- Vérification : doit afficher les 4 livres
SELECT id, titre, auteur, annee, fichier_numerique FROM documents ORDER BY id;
`;
fs.writeFileSync("/home/claude/neon-init.sql", out);
console.log("lignes:", out.split("\n").length, "octets:", out.length);
