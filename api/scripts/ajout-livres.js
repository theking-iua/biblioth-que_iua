// Ajoute au catalogue les livres du dossier api/db/livres/ (notices + fichiers numériques + couvertures).
//
//   npm run db:livres                        → ajoute les livres (relançable sans doublon)
//   npm run db:livres -- --inclure-proteges  → attache aussi les PDF d'œuvres protégées (si la bibliothèque en a le droit)
//
// Les fichiers sont copiés dans uploads/documents/ (dossier UPLOAD_DIR de l'API).
import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, tx } from "../src/db.js";
import { config } from "../src/config.js";
import { logActivity } from "../src/logger.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "livres");
const withProtected = process.argv.includes("--inclure-proteges");
const outDir = path.join(config.uploadDir, "documents");
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");

if (!config.databaseUrl) {
  console.error("DATABASE_URL manquant dans api/.env (base Neon).");
  process.exit(1);
}

const livres = JSON.parse(await fs.readFile(path.join(dir, "livres.json"), "utf8"));

/** Copie un fichier du dossier livres vers uploads/documents et renvoie son chemin public. */
async function publish(name) {
  const src = path.join(dir, name);
  if (!fss.existsSync(src)) return null;
  await fs.mkdir(outDir, { recursive: true });
  const target = slug(name);
  await fs.copyFile(src, path.join(outDir, target));
  return `/uploads/documents/${target}`;
}

try {
  const bilan = await tx(async (t) => {
    let ajoutes = 0, completes = 0;
    const notes = [];
    for (const l of livres) {
      const fichier = l.fichier && (!l.protege || withProtected) ? await publish(l.fichier) : null;
      if (l.fichier && l.protege && !withProtected) notes.push(`« ${l.titre} » : œuvre protégée, PDF non mis en ligne (option --inclure-proteges).`);
      else if (l.fichier && !fichier) notes.push(`« ${l.titre} » : fichier ${l.fichier} absent du dossier api/db/livres/.`);
      const couverture = l.couverture ? await publish(l.couverture) : null;

      await t.run("INSERT INTO categories (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [l.categorie]);
      await t.run("INSERT INTO authors (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [l.auteur]);
      if (l.editeur) await t.run("INSERT INTO publishers (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [l.editeur]);
      if (l.localisation) await t.run("INSERT INTO locations (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [l.localisation]);

      // Déjà au catalogue (même ISBN, ou même titre et auteur) : on complète sans écraser
      const existing = await t.one(
        `SELECT id FROM documents WHERE (? <> '' AND replace(coalesce(isbn,''),'-','') = replace(?,'-',''))
            OR (lower(titre) = lower(?) AND lower(auteur) = lower(?)) LIMIT 1`,
        [l.isbn || "", l.isbn || "", l.titre, l.auteur]
      );
      if (existing) {
        completes += await t.run(
          `UPDATE documents SET fichier_numerique = COALESCE(fichier_numerique, ?), couverture_url = COALESCE(NULLIF(couverture_url, ''), ?),
                  resume = COALESCE(NULLIF(resume, ''), ?) WHERE id = ?`,
          [fichier, couverture, l.resume, existing.id]
        );
        continue;
      }
      const id = await t.insert(
        `INSERT INTO documents (titre, auteur, editeur, annee, isbn, langue, categorie, cote, localisation, resume, mots_cles, type_document, nb_pages, couleur, couverture_url, fichier_numerique, disponible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [l.titre, l.auteur, l.editeur || null, l.annee || null, l.isbn || null, l.langue || "Français", l.categorie, l.cote || null,
         l.localisation || null, l.resume || null, l.mots_cles || null, l.type_document || "livre", l.nb_pages || null, l.couleur || "#101B33",
         couverture, fichier]
      );
      await logActivity(t, null, `Ajout au catalogue : "${l.titre}" (${l.auteur})`, { cibleType: "document", cibleId: id, user: { id: null, nom: "Ajout de livres", role: "systeme" } });
      ajoutes++;
    }
    return { ajoutes, completes, notes };
  });
  console.log(`✔ ${bilan.ajoutes} livre(s) ajouté(s) au catalogue, ${bilan.completes} déjà au catalogue (complété(s) si besoin).`);
  for (const n of bilan.notes) console.log(`  ⚠ ${n}`);
  console.log(`Fichiers copiés dans ${outDir} : mettez ce dossier en ligne avec l'API.`);
  console.log("Exemplaires papier : à ajouter depuis l'admin (Catalogue → Exemplaires) si la bibliothèque possède ces livres.");
} catch (e) {
  console.error("✘ Ajout interrompu, rien n'a été enregistré :", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
