// Import en masse des étudiants (lecteurs) depuis un CSV.
// Colonnes (séparateur ; ou ,) avec une ligne d'en-tête : nom ; prenom ; matricule ; filiere ; email ; telephone
// Nouveau compte : rôle « adherent », mot de passe initial = matricule.
// Compte existant (même matricule ou email) : mis à jour sans toucher au mot de passe ; le personnel n'est jamais modifié.
import bcrypt from "bcryptjs";
import { logActivity } from "./logger.js";

/** Décode en UTF-8, ou en Windows-1252 si le fichier vient d'Excel (accents mal encodés). */
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Analyse CSV minimale gérant les guillemets. */
function parseCsv(text, sep) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function importReadersCsv(ex, req, buffer) {
  const text = decode(buffer);
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = parseCsv(text, sep).slice(1); // en-tête

  let created = 0, updated = 0, skipped = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const line = i + 2;
    const cells = rows[i].map((v) => String(v ?? "").trim());
    if (!cells.some(Boolean)) continue;
    const [nom = "", prenom = "", matricule = "", filiere = "", emailRaw = "", telephone = ""] = cells;
    if (!nom || !matricule) { errors.push(`Ligne ${line} : nom et matricule obligatoires.`); continue; }
    const email = (emailRaw || `${matricule.replace(/[^a-z0-9]/gi, "")}@iua.ci`).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push(`Ligne ${line} : email invalide (${email}).`); continue; }

    const existing = await ex.one("SELECT id, role FROM users WHERE (matricule = ? AND matricule <> '') OR lower(email) = ? LIMIT 1", [matricule, email]);
    if (existing) {
      if (!["adherent", "visiteur"].includes(existing.role)) { skipped++; continue; }
      await ex.run("UPDATE users SET nom = ?, prenom = ?, filiere = ?, telephone = ? WHERE id = ?", [nom, prenom, filiere, telephone, existing.id]);
      updated++;
    } else {
      await ex.run(
        `INSERT INTO users (nom, prenom, email, mot_de_passe, matricule, filiere, telephone, role, statut)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'adherent', 'actif')`,
        [nom, prenom, email, await bcrypt.hash(matricule, 10), matricule, filiere, telephone]
      );
      created++;
    }
  }
  const message = `Import CSV : ${created} créé(s), ${updated} mis à jour, ${skipped} ignoré(s) (personnel), ${errors.length} erreur(s)`;
  await logActivity(ex, req, message, { cibleType: "import", details: { erreurs: errors.slice(0, 50) } });
  return { created, updated, skipped, errors, message };
}
