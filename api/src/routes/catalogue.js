// Notices (catalogue), exemplaires physiques, référentiels et mémoires/thèses.
import { Router } from "express";
import { db, tx } from "../db.js";
import { ah, fail } from "../errors.js";
import { requireStaff, isStaff } from "../auth.js";
import { logActivity } from "../logger.js";
import { refreshDocumentAvailability } from "../circulation.js";

const r = Router();
const str = (v, def = "") => (v === undefined || v === null ? def : String(v)).trim();
const int = (v, def) => (v === undefined || v === null || v === "" || Number.isNaN(parseInt(v, 10)) ? def : parseInt(v, 10));
const TYPES_DOC = ["livre", "memoire", "these", "revue", "cours"];
const code = (docId, n) => `IUA-EX-${String(docId).padStart(4, "0")}-${String(n).padStart(2, "0")}`;

// ================================================================ /api/catalogue

r.get("/catalogue", ah(async (req, res) => {
  const id = int(req.query.id, null);
  if (id) {
    // Fiche détaillée avec exemplaires et réservations
    const doc = await db.one(
      `SELECT d.*, COUNT(c.id) AS total_copies,
              COUNT(c.id) FILTER (WHERE c.statut = 'disponible') AS copies_disponibles
       FROM documents d LEFT JOIN document_copies c ON d.id = c.document_id
       WHERE d.id = ? GROUP BY d.id`,
      [id]
    );
    if (!doc) fail("Document non trouvé", 404);
    doc.copies = await db.all("SELECT * FROM document_copies WHERE document_id = ? ORDER BY numero_exemplaire ASC", [id]);
    // Détail nominatif réservé au personnel, simple file anonyme pour le public
    doc.reservations = isStaff(req.user)
      ? await db.all(
          `SELECT r.*, u.nom AS user_nom, u.email AS user_email FROM reservations r JOIN users u ON r.user_id = u.id
           WHERE r.document_id = ? AND r.statut = 'en_attente' ORDER BY r.rang_file ASC`,
          [id]
        )
      : await db.all("SELECT id, rang_file, statut FROM reservations WHERE document_id = ? AND statut = 'en_attente' ORDER BY rang_file", [id]);
    return res.json(doc);
  }

  const q = str(req.query.q), cat = str(req.query.categorie), type = str(req.query.type);
  let sql = `
    SELECT d.*, COUNT(c.id) AS total_copies,
           COUNT(c.id) FILTER (WHERE c.statut = 'disponible') AS copies_disponibles
    FROM documents d LEFT JOIN document_copies c ON d.id = c.document_id
    WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (f_unaccent(d.titre) LIKE f_unaccent(?) OR f_unaccent(d.auteur) LIKE f_unaccent(?) OR coalesce(d.isbn,'') ILIKE ?
             OR f_unaccent(coalesce(d.editeur,'')) LIKE f_unaccent(?) OR coalesce(d.cote,'') ILIKE ? OR f_unaccent(coalesce(d.mots_cles,'')) LIKE f_unaccent(?))`;
    params.push(...Array(6).fill(`%${q}%`));
  }
  if (cat && cat !== "Toutes") { sql += " AND d.categorie = ?"; params.push(cat); }
  if (type && type !== "Tous") { sql += " AND d.type_document = ?"; params.push(type); }
  sql += " GROUP BY d.id ORDER BY d.date_ajout DESC, d.id DESC";

  const docs = await db.all(sql, params);
  // « disponible » reflète au moins un exemplaire disponible
  for (const d of docs) if (d.total_copies > 0) d.disponible = d.copies_disponibles > 0 ? 1 : 0;
  res.json(docs);
}));

function docFields(d, forUpdate = false) {
  return {
    titre: str(d.titre),
    auteur: str(d.auteur),
    categorie: str(d.categorie, forUpdate ? "" : "Informatique"),
    couleur: d.couleur || "#101B33",
    isbn: str(d.isbn),
    editeur: str(d.editeur),
    annee: int(d.annee, 2024),
    langue: d.langue || "Français",
    cote: str(d.cote),
    localisation: str(d.localisation, forUpdate ? "" : "Rayon B — Étagère 4"),
    resume: str(d.resume),
    mots_cles: str(d.mots_cles),
    type_document: TYPES_DOC.includes(d.type_document) ? d.type_document : "livre",
    nb_pages: int(d.nb_pages, 250),
    couverture_url: str(d.couverture_url),
  };
}

r.post("/catalogue", ah(async (req, res) => {
  requireStaff(req);
  const f = docFields(req.body || {});
  const nbEx = Math.max(0, Math.min(100, int(req.body?.nb_exemplaires, 2)));
  if (!f.titre || !f.auteur || !f.categorie) fail("Titre, auteur et catégorie sont obligatoires");

  const docId = await tx(async (t) => {
    const id = await t.insert(
      `INSERT INTO documents (titre, auteur, categorie, couleur, isbn, editeur, annee, langue, cote, localisation, resume, mots_cles, type_document, nb_pages, couverture_url, disponible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [f.titre, f.auteur, f.categorie, f.couleur, f.isbn, f.editeur, f.annee, f.langue, f.cote, f.localisation, f.resume, f.mots_cles, f.type_document, f.nb_pages, f.couverture_url]
    );
    // Génération automatique des exemplaires physiques
    for (let i = 1; i <= nbEx; i++) {
      await t.run("INSERT INTO document_copies (document_id, code_barre, numero_exemplaire, etat, statut) VALUES (?, ?, ?, 'neuf', 'disponible')", [id, code(id, i), i]);
    }
    if (nbEx === 0) await t.run("UPDATE documents SET disponible = 0 WHERE id = ?", [id]);
    await logActivity(t, req, `Ajout au catalogue : "${f.titre}" (${f.auteur})`, { cibleType: "document", cibleId: id, details: { categorie: f.categorie, exemplaires: nbEx } });
    return id;
  });
  res.json({ success: true, id: docId });
}));

r.put("/catalogue", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const id = int(d.id, null);
  const f = docFields(d, true);
  const disponible = d.disponible !== undefined ? int(d.disponible, 1) : 1;
  if (!id || !f.titre || !f.auteur || !f.categorie) fail("Champs obligatoires manquants");
  await db.run(
    `UPDATE documents SET titre = ?, auteur = ?, categorie = ?, couleur = ?, isbn = ?, editeur = ?, annee = ?, langue = ?, cote = ?, localisation = ?,
       resume = ?, mots_cles = ?, type_document = ?, nb_pages = ?, couverture_url = ?, disponible = ? WHERE id = ?`,
    [f.titre, f.auteur, f.categorie, f.couleur, f.isbn, f.editeur, f.annee, f.langue, f.cote, f.localisation, f.resume, f.mots_cles, f.type_document, f.nb_pages, f.couverture_url, disponible ? 1 : 0, id]
  );
  await logActivity(db, req, `Mise à jour de l'ouvrage : "${f.titre}"`, { cibleType: "document", cibleId: id });
  res.json({ success: true });
}));

r.delete("/catalogue", ah(async (req, res) => {
  requireStaff(req);
  const id = int(req.query.id, null);
  if (!id) fail("ID manquant");
  const titre = (await db.val("SELECT titre FROM documents WHERE id = ?", [id])) || `ID #${id}`;
  if ((await db.val("SELECT COUNT(*) FROM loans WHERE document_id = ? AND statut IN ('en_cours','en_retard')", [id])) > 0) {
    fail("Impossible de supprimer : des exemplaires de ce document sont actuellement prêtés.", 409);
  }
  await db.run("DELETE FROM documents WHERE id = ?", [id]);
  await logActivity(db, req, `Suppression de l'ouvrage du catalogue : "${titre}"`, { cibleType: "document", cibleId: id });
  res.json({ success: true });
}));

// ================================================================ /api/copies

r.get("/copies", ah(async (req, res) => {
  const documentId = int(req.query.document_id, null);
  if (documentId) {
    return res.json(await db.all(
      `SELECT c.*, d.titre, d.cote, d.localisation FROM document_copies c JOIN documents d ON c.document_id = d.id
       WHERE c.document_id = ? ORDER BY c.numero_exemplaire ASC`,
      [documentId]
    ));
  }
  res.json(await db.all(
    `SELECT c.*, d.titre, d.auteur, d.cote, d.localisation, d.categorie FROM document_copies c JOIN documents d ON c.document_id = d.id
     ORDER BY c.document_id ASC, c.numero_exemplaire ASC`
  ));
}));

r.post("/copies", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const documentId = int(d.document_id, 0);
  if (!documentId) fail("ID document manquant");
  const etat = ["neuf", "bon", "moyen", "abime"].includes(d.etat) ? d.etat : "bon";
  const statut = ["disponible", "maintenance"].includes(d.statut) ? d.statut : "disponible";

  const out = await tx(async (t) => {
    const nextNum = await t.val("SELECT COALESCE(MAX(numero_exemplaire), 0) + 1 FROM document_copies WHERE document_id = ?", [documentId]);
    const codeBarre = str(d.code_barre) || code(documentId, nextNum);
    const id = await t.insert(
      "INSERT INTO document_copies (document_id, code_barre, numero_exemplaire, etat, statut) VALUES (?, ?, ?, ?, ?)",
      [documentId, codeBarre, nextNum, etat, statut]
    );
    await refreshDocumentAvailability(t, documentId);
    await logActivity(t, req, `Ajout d'un exemplaire physique (${codeBarre})`, { cibleType: "copy", cibleId: id, details: { document_id: documentId, etat } });
    return { id, code_barre: codeBarre, numero: nextNum };
  });
  res.json({ success: true, ...out });
}));

r.put("/copies", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const id = int(d.id, null);
  const etat = d.etat ?? "bon";
  const statut = d.statut ?? "disponible";
  if (!id) fail("ID exemplaire manquant");
  if (!["neuf", "bon", "moyen", "abime"].includes(etat)) fail("État invalide");
  if (!["disponible", "emprunte", "reserve", "maintenance", "perdu"].includes(statut)) fail("Statut invalide");

  const cp = await db.one("SELECT document_id, code_barre, statut FROM document_copies WHERE id = ?", [id]);
  if (!cp) fail("Exemplaire introuvable", 404);
  if (cp.statut === "emprunte" && statut !== "emprunte" && statut !== "perdu") {
    fail("Cet exemplaire est prêté : enregistrez son retour depuis la circulation.", 409);
  }
  await db.run("UPDATE document_copies SET etat = ?, statut = ? WHERE id = ?", [etat, statut, id]);
  await refreshDocumentAvailability(db, cp.document_id);
  await logActivity(db, req, `Mise à jour exemplaire ${cp.code_barre} : état=${etat}, statut=${statut}`, { cibleType: "copy", cibleId: id });
  res.json({ success: true });
}));

r.delete("/copies", ah(async (req, res) => {
  requireStaff(req);
  const id = int(req.query.id, null);
  if (!id) fail("ID manquant");
  const cp = await db.one("SELECT code_barre, document_id, statut FROM document_copies WHERE id = ?", [id]);
  if (!cp) fail("Exemplaire introuvable", 404);
  if (cp.statut === "emprunte") fail("Impossible de supprimer un exemplaire actuellement prêté.", 409);
  await db.run("DELETE FROM document_copies WHERE id = ?", [id]);
  await refreshDocumentAvailability(db, cp.document_id);
  await logActivity(db, req, `Suppression exemplaire physique ${cp.code_barre}`, { cibleType: "copy", cibleId: id });
  res.json({ success: true });
}));

// ================================================================ /api/taxonomies

const TAXO = {
  categories: ["code", "description"],
  authors: ["biographie", "nationalite"],
  publishers: ["ville", "pays"],
  locations: ["batiment", "salle", "rayon", "etagere"],
};

r.all("/taxonomies", ah(async (req, res) => {
  if (req.method === "GET" && req.query.all !== undefined) {
    const [categories, authors, publishers, locations] = await Promise.all(
      Object.keys(TAXO).map((t) => db.all(`SELECT * FROM ${t} ORDER BY nom ASC`))
    );
    return res.json({ categories, authors, publishers, locations });
  }
  const type = String(req.query.type || "categories");
  if (!TAXO[type]) fail("Type non supporté");
  const cols = TAXO[type];

  if (req.method === "GET") return res.json(await db.all(`SELECT * FROM ${type} ORDER BY nom ASC`));

  requireStaff(req);
  const d = req.body || {};
  if (req.method === "POST") {
    const nom = str(d.nom);
    if (!nom) fail("Le nom est requis");
    const vals = cols.map((c) => str(d[c], c === "pays" ? "Côte d'Ivoire" : ""));
    const id = await db.insert(`INSERT INTO ${type} (nom, ${cols.join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`, [nom, ...vals]);
    await logActivity(db, req, `Ajout taxonomie (${type}) : "${nom}"`, { cibleType: type, cibleId: id });
    return res.json({ success: true, id });
  }
  if (req.method === "PUT") {
    const id = int(d.id, null), nom = str(d.nom);
    if (!id || !nom) fail("ID et nom requis");
    await db.run(`UPDATE ${type} SET nom = ?, ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, [nom, ...cols.map((c) => str(d[c])), id]);
    await logActivity(db, req, `Modification taxonomie (${type}) : "${nom}"`, { cibleType: type, cibleId: id });
    return res.json({ success: true });
  }
  if (req.method === "DELETE") {
    const id = int(req.query.id, null);
    if (!id) fail("ID manquant");
    await db.run(`DELETE FROM ${type} WHERE id = ?`, [id]);
    await logActivity(db, req, `Suppression taxonomie (${type}) #${id}`, { cibleType: type, cibleId: id });
    return res.json({ success: true });
  }
  fail("Méthode non autorisée", 405);
}));

// ================================================================ /api/digital-resources (mémoires & thèses)

r.get("/digital-resources", ah(async (req, res) => {
  const id = int(req.query.id, null);
  const action = req.query.action;

  if (id && (action === "view" || action === "download")) {
    const col = action === "view" ? "nb_vues" : "nb_telechargements";
    const titre = await db.val(`UPDATE digital_resources SET ${col} = ${col} + 1 WHERE id = ? RETURNING titre`, [id]);
    await logActivity(db, req, `${action === "view" ? "Lecture en ligne" : "Téléchargement"} du mémoire : "${titre}"`, { cibleType: "digital_resource", cibleId: id });
    return res.json({ success: true });
  }
  if (id) {
    const row = await db.one("SELECT * FROM digital_resources WHERE id = ?", [id]);
    if (!row) fail("Ressource non trouvée", 404);
    return res.json(row);
  }

  const q = str(req.query.q), filiere = str(req.query.filiere), cycle = str(req.query.cycle);
  let sql = "SELECT * FROM digital_resources WHERE 1=1";
  const params = [];
  if (q) {
    sql += ` AND (f_unaccent(titre) LIKE f_unaccent(?) OR f_unaccent(auteur) LIKE f_unaccent(?) OR f_unaccent(coalesce(directeur_recherche,'')) LIKE f_unaccent(?)
             OR f_unaccent(coalesce(mots_cles,'')) LIKE f_unaccent(?) OR f_unaccent(coalesce(resume,'')) LIKE f_unaccent(?) OR f_unaccent(coalesce(contenu_texte,'')) LIKE f_unaccent(?))`;
    params.push(...Array(6).fill(`%${q}%`));
  }
  if (filiere && filiere !== "Toutes") { sql += " AND filiere = ?"; params.push(filiere); }
  if (cycle && cycle !== "Tous") { sql += " AND cycle = ?"; params.push(cycle); }
  sql += " ORDER BY date_publication DESC, id DESC";
  res.json(await db.all(sql, params));
}));

const CYCLES = ["Licence", "Master", "Doctorat", "Recherche"];

r.post("/digital-resources", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const titre = str(d.titre), auteur = str(d.auteur), filiere = str(d.filiere);
  if (!titre || !auteur || !filiere) fail("Titre, auteur et filière sont requis");
  const id = await db.insert(
    `INSERT INTO digital_resources (titre, auteur, directeur_recherche, filiere, cycle, annee_academique, session_soutenance, note_mention, resume, mots_cles, fichier_path, telechargeable, contenu_texte)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titre, auteur, str(d.directeur_recherche), filiere, CYCLES.includes(d.cycle) ? d.cycle : "Master", d.annee_academique || "2023-2024",
     d.session_soutenance || "Session de Juillet", d.note_mention || "Très Bien", d.resume || "", d.mots_cles || "",
     str(d.fichier_path) || null, d.telechargeable !== undefined ? (int(d.telechargeable, 1) ? 1 : 0) : 1, d.contenu_texte || ""]
  );
  await logActivity(db, req, `Ajout d'un nouveau mémoire : "${titre}"`, { cibleType: "digital_resource", cibleId: id });
  res.json({ success: true, id });
}));

r.put("/digital-resources", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const id = int(d.id, null);
  if (!id) fail("ID manquant");
  if (!d.titre || !d.auteur || !d.filiere) fail("Titre, auteur et filière sont requis");
  await db.run(
    `UPDATE digital_resources SET titre = ?, auteur = ?, directeur_recherche = ?, filiere = ?, cycle = ?, annee_academique = ?, session_soutenance = ?,
       note_mention = ?, resume = ?, mots_cles = ?, telechargeable = ?,
       contenu_texte = COALESCE(?, contenu_texte), fichier_path = COALESCE(NULLIF(?, ''), fichier_path)
     WHERE id = ?`,
    [d.titre, d.auteur, d.directeur_recherche ?? "", d.filiere, CYCLES.includes(d.cycle) ? d.cycle : "Master", d.annee_academique ?? "",
     d.session_soutenance ?? "", d.note_mention ?? "", d.resume ?? "", d.mots_cles ?? "", int(d.telechargeable, 1) ? 1 : 0,
     d.contenu_texte ?? null, d.fichier_path ?? "", id]
  );
  await logActivity(db, req, `Modification du mémoire : "${d.titre}"`, { cibleType: "digital_resource", cibleId: id });
  res.json({ success: true });
}));

r.delete("/digital-resources", ah(async (req, res) => {
  requireStaff(req);
  const id = int(req.query.id, null);
  if (!id) fail("ID manquant");
  const titre = (await db.val("SELECT titre FROM digital_resources WHERE id = ?", [id])) || `ID #${id}`;
  await db.run("DELETE FROM digital_resources WHERE id = ?", [id]);
  await logActivity(db, req, `Suppression du mémoire : "${titre}"`, { cibleType: "digital_resource", cibleId: id });
  res.json({ success: true });
}));

export default r;
