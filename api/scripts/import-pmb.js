// Reprise des données de l'ancien PMB (PMB Services, MySQL) dans la base Neon du nouveau SIGB.
//
//   npm run import:pmb -- --mysql "mysql://root:@localhost:3306/bibli"
//   npm run import:pmb -- --mysql "mysql://root:@localhost:3306/biblio" --fichiers "C:\wamp\www\PMBTL"
//
// Options :
//   --mysql <url>        base PMB à lire (ou variable PMB_MYSQL_URL). Le nom de la base sert d'étiquette.
//   --fichiers <dossier> dossier de l'ancien PMB : pour retrouver les documents numériques enregistrés sur disque
//   --sans-historique    ne pas reprendre l'historique des prêts rendus
//   --essai              tout calculer et afficher le bilan, puis annuler (rien n'est écrit)
//
// Ce qui est repris : notices (+ numéros de revues), exemplaires, lecteurs (avec leur mot de passe PMB),
// prêts en cours, historique des prêts, réservations, auteurs, éditeurs, localisations, catégories,
// documents numériques (liens et fichiers).
// L'import peut être relancé : ce qui a déjà été importé (table pmb_import_map) est ignoré.
import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool, tx, sqlDate } from "../src/db.js";
import { config } from "../src/config.js";
import { logActivity } from "../src/logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- Options
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name) => args.includes(`--${name}`);

const MYSQL_URL = opt("mysql") || process.env.PMB_MYSQL_URL;
const FILES_DIR = opt("fichiers");
const WITH_HISTORY = !flag("sans-historique");
const DRY_RUN = flag("essai");

if (!MYSQL_URL) {
  console.error('Indiquez la base PMB : npm run import:pmb -- --mysql "mysql://root:@localhost:3306/bibli"');
  process.exit(1);
}
if (!config.databaseUrl) {
  console.error("DATABASE_URL manquant dans api/.env (base Neon de destination).");
  process.exit(1);
}

let mysql;
try {
  mysql = await import("mysql2/promise");
} catch {
  console.error("Le module mysql2 est nécessaire : cd api && npm install mysql2");
  process.exit(1);
}

// ---------------------------------------------------------------- Outils
const log = (...a) => console.log(...a);
const NOW = sqlDate(new Date()); // date du jour (heure de la bibliothèque) pour les dates absentes dans PMB
const clean = (v) => {
  if (v === null || v === undefined) return "";
  let s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);
  // Texte enregistré en UTF-8 dans des colonnes latin1 (cas fréquent sous PMB 4) : « Ã© » → « é »
  if (/Ã[\u0080-\u00BF©¨ª«®´¢§¹ ]|Ã‰|Ã€|Ã§|Ãª|Ã¨|Ã©|Ã®|Ã´|Ã»|Ã¢/.test(s)) {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (!fixed.includes("\uFFFD")) s = fixed;
  }
  return s.replace(/\s+/g, " ").trim();
};
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const nullDate = (d) => (!d || String(d).startsWith("0000") ? null : String(d).slice(0, 19));
const firstInt = (s) => {
  const m = /(\d{1,6})/.exec(String(s || ""));
  return m ? parseInt(m[1], 10) : null;
};
// « 1 vol. (160 p.) », « 179 p. », « [395] p. », « 320 pages » → nombre de pages
const pagesOf = (s) => {
  const t = String(s || "");
  const m = /(\d{1,5})\]?\s*(p\b|p\.|pages?)/i.exec(t) || /\[(\d{1,5})\]/.exec(t);
  if (m) return parseInt(m[1], 10);
  return /vol|disque|cd|dvd|min/i.test(t) ? null : firstInt(t);
};
const year = (s) => {
  const m = /(1[5-9]\d\d|20\d\d)/.exec(String(s || ""));
  return m ? parseInt(m[1], 10) : null;
};
const isEmail = (s) => /^[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+$/.test(s);
const PALETTE = ["#1D4ED8", "#0F766E", "#7C3AED", "#B91C1C", "#92400E", "#065F46", "#1E3A8A", "#BE185D", "#C2410C", "#4338CA", "#475569", "#101B33"];
const LANGUES = { fre: "Français", fra: "Français", eng: "Anglais", ara: "Arabe", spa: "Espagnol", ger: "Allemand", deu: "Allemand", ita: "Italien", por: "Portugais", chi: "Chinois", zho: "Chinois", rus: "Russe", lat: "Latin" };

/** Insertion par paquets avec identifiants choisis à l'avance (correspondance PMB → nouvel id garantie). */
async function bulkInsert(t, table, cols, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const values = part.map((r) => "(" + cols.map((c) => { params.push(r[c] ?? null); return "$" + params.length; }).join(",") + ")");
    await t.client.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${values.join(",")}`, params);
  }
}
async function reserveIds(t, table, n) {
  if (!n) return [];
  const r = await t.client.query(`SELECT nextval(pg_get_serial_sequence('${table}', 'id'))::int AS id FROM generate_series(1, $1)`, [n]);
  return r.rows.map((x) => x.id);
}

// ---------------------------------------------------------------- Lecture de la base PMB
const src = await mysql.createConnection({ uri: MYSQL_URL, dateStrings: true, charset: "utf8mb4", supportBigNumbers: true });
const [[{ db: BASE }]] = await src.query("SELECT DATABASE() AS db");
const q = async (sql, p = []) => (await src.query(sql, p))[0];
const hasTable = async (name) => (await q("SHOW TABLES LIKE ?", [name])).length > 0;

log(`Lecture de la base PMB « ${BASE} »…`);
const S = {
  notices: await q("SELECT * FROM notices"),
  bulletins: (await hasTable("bulletins")) ? await q("SELECT * FROM bulletins") : [],
  expl: await q("SELECT * FROM exemplaires"),
  resp: await q(`SELECT r.responsability_notice AS n, r.responsability_type AS t, r.responsability_ordre AS o, a.author_name AS nom, a.author_rejete AS prenom, a.author_id AS id
                 FROM responsability r JOIN authors a ON a.author_id = r.responsability_author ORDER BY r.responsability_notice, r.responsability_type, r.responsability_ordre`),
  publishers: await q("SELECT * FROM publishers"),
  locations: await q("SELECT idlocation, location_libelle FROM docs_location"),
  sections: await q("SELECT idsection, section_libelle FROM docs_section"),
  statuts: await q("SELECT idstatut, statut_libelle, pret_flag FROM docs_statut"),
  types: await q("SELECT idtyp_doc, tdoc_libelle FROM docs_type"),
  categs: await q(`SELECT nc.notcateg_notice AS n, c.libelle_categorie AS lib FROM notices_categories nc
                   JOIN categories c ON c.num_noeud = nc.num_noeud
                   WHERE c.libelle_categorie <> '' AND (c.langue = 'fr_FR' OR c.langue = '')
                   ORDER BY nc.notcateg_notice, nc.ordre_categorie`),
  indexint: await q("SELECT indexint_id, indexint_name, indexint_comment FROM indexint"),
  langues: await q("SELECT num_notice, code_langue FROM notices_langues WHERE type_langue = 0 ORDER BY ordre_langue"),
  empr: await q("SELECT * FROM empr"),
  emprStatut: await q("SELECT idstatut, allow_loan FROM empr_statut"),
  emprCateg: (await hasTable("empr_categ")) ? await q("SELECT id_categ_empr, libelle FROM empr_categ") : [],
  pret: await q("SELECT * FROM pret"),
  archive: WITH_HISTORY && (await hasTable("pret_archive")) ? await q("SELECT * FROM pret_archive") : [],
  resa: (await hasTable("resa")) ? await q("SELECT * FROM resa ORDER BY resa_date, id_resa") : [],
  explnum: (await hasTable("explnum")) ? await q("SELECT explnum_id, explnum_notice, explnum_bulletin, explnum_nom, explnum_mimetype, explnum_url, explnum_extfichier, explnum_nomfichier, explnum_repertoire, explnum_path, LENGTH(explnum_data) AS taille FROM explnum") : [],
  analysis: (await hasTable("analysis")) ? await q("SELECT analysis_bulletin, analysis_notice FROM analysis") : [],
  repertoires: (await hasTable("upload_repertoire")) ? await q("SELECT repertoire_id, repertoire_path FROM upload_repertoire") : [],
};
log(`  ${S.notices.length} notices, ${S.bulletins.length} numéros de revues, ${S.expl.length} exemplaires, ${S.empr.length} lecteurs,`);
log(`  ${S.pret.length} prêts en cours, ${S.archive.length} prêts archivés, ${S.resa.length} réservations, ${S.explnum.length} documents numériques`);

const by = (arr, key) => new Map(arr.map((x) => [x[key], x]));
const group = (arr, key) => {
  const m = new Map();
  for (const x of arr) (m.get(x[key]) || m.set(x[key], []).get(x[key])).push(x);
  return m;
};
const pubById = by(S.publishers, "ed_id");
const locById = by(S.locations, "idlocation");
const secById = by(S.sections, "idsection");
const statById = by(S.statuts, "idstatut");
const typeById = by(S.types, "idtyp_doc");
const idxById = by(S.indexint, "indexint_id");
const emprStatById = by(S.emprStatut, "idstatut");
const emprCategById = by(S.emprCateg, "id_categ_empr");
const respByNotice = group(S.resp, "n");
const categByNotice = group(S.categs, "n");
const langByNotice = group(S.langues, "num_notice");
const explByNotice = group(S.expl.filter((e) => e.expl_notice > 0), "expl_notice");
const explByBulletin = group(S.expl.filter((e) => e.expl_bulletin > 0), "expl_bulletin");
const noticeById = by(S.notices, "notice_id");
const activeArcIds = new Set(S.pret.map((p) => p.pret_arc_id).filter(Boolean));
const loanedExpl = new Set(S.pret.map((p) => p.pret_idexpl));

const report = { ignores: [], avertissements: [] };
const warn = (m) => report.avertissements.push(m);

// ---------------------------------------------------------------- Écriture dans Neon
const started = Date.now();
try {
  await tx(async (t) => {
    // Schéma à jour (table de correspondance)
    const schema = (await fs.readFile(path.join(here, "..", "db", "schema.sql"), "utf8")).replaceAll("__APP_TIMEZONE__", config.timezone);
    await t.client.query(schema);

    const mapped = async (entite) => {
      const rows = await t.all("SELECT pmb_id, new_id FROM pmb_import_map WHERE entite = ? AND base = ?", [entite, BASE]);
      return new Map(rows.map((r) => [r.pmb_id, r.new_id]));
    };
    const saveMap = (entite, pairs) =>
      bulkInsert(t, "pmb_import_map", ["entite", "base", "pmb_id", "new_id"], pairs.map(([p, n]) => ({ entite, base: BASE, pmb_id: p, new_id: n })));

    // ------------------------------------------------ Référentiels
    const authorsSet = new Set(S.resp.map((r) => cut(clean([r.prenom, r.nom].filter((x) => clean(x)).join(" ")), 255)).filter(Boolean));
    for (const nom of authorsSet) await t.run("INSERT INTO authors (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [nom]);
    for (const p of S.publishers) {
      const nom = cut(clean(p.ed_name), 255);
      if (nom) await t.run("INSERT INTO publishers (nom, ville, pays) VALUES (?, ?, ?) ON CONFLICT (nom) DO NOTHING", [nom, cut(clean(p.ed_ville), 100), cut(clean(p.ed_pays), 100) || null]);
    }

    // ------------------------------------------------ Description d'un document (notice ou numéro de revue)
    const placeOf = (copies) => {
      const e = copies?.[0];
      if (!e) return { localisation: "", cote: "" };
      const loc = clean(locById.get(e.expl_location)?.location_libelle);
      const sec = clean(secById.get(e.expl_section)?.section_libelle);
      return { localisation: cut([loc, sec].filter(Boolean).join(" — "), 100), cote: cut(clean(e.expl_cote), 50) };
    };
    const authorsOf = (noticeId) => {
      const list = (respByNotice.get(noticeId) || []).map((r) => clean([r.prenom, r.nom].filter((x) => clean(x)).join(" "))).filter(Boolean);
      const uniq = [...new Set(list)];
      return uniq.length ? cut(uniq.slice(0, 3).join(", ") + (uniq.length > 3 ? " et al." : ""), 255) : "";
    };
    const categoryOf = (n, copies) => {
      const c = (categByNotice.get(n.notice_id) || []).map((x) => clean(x.lib)).find(Boolean);
      if (c) return c;
      const ix = idxById.get(n.indexint);
      if (ix) return clean(ix.indexint_comment) || clean(ix.indexint_name);
      const sec = copies?.[0] && clean(secById.get(copies[0].expl_section)?.section_libelle);
      return sec || "Non classé";
    };
    const typeOf = (n, copies, isSerial) => {
      const hay = [n.tit1, copies?.[0] && typeById.get(copies[0].expl_typdoc)?.tdoc_libelle, copies?.[0] && secById.get(copies[0].expl_section)?.section_libelle]
        .map(clean).join(" ").toLowerCase();
      if (/m[ée]moire/.test(hay)) return "memoire";
      if (/th[èe]se/.test(hay)) return "these";
      if (isSerial || /revue|p[ée]riodique|magazine|journal/.test(hay)) return "revue";
      if (/\bcours\b|polycopi/.test(hay)) return "cours";
      return "livre";
    };
    const docRow = (n, copies, extra = {}) => {
      const titre = cut(clean(n.tit1) + (clean(n.tit4) ? ` : ${clean(n.tit4)}` : ""), 255) || "Sans titre";
      const lang = (langByNotice.get(n.notice_id) || [])[0]?.code_langue;
      const place = placeOf(copies);
      const resume = clean(n.n_resume) || clean(n.n_contenu);
      const thumb = clean(n.thumbnail_url);
      return {
        titre,
        isbn: cut(clean(n.code), 50) || null,
        auteur: authorsOf(n.notice_id) || "Anonyme",
        editeur: cut(clean(pubById.get(n.ed1_id)?.ed_name), 255) || null,
        annee: year(n.year) ?? year(n.date_parution),
        langue: LANGUES[clean(lang)] || "Français",
        categorie: cut(categoryOf(n, copies), 100),
        cote: place.cote || null,
        localisation: place.localisation || null,
        resume: resume || null,
        mots_cles: cut(clean(n.index_l).split(";").map((x) => x.trim()).filter(Boolean).join(", "), 255) || null,
        couleur: PALETTE[n.notice_id % PALETTE.length],
        couverture_url: /^https?:\/\//.test(thumb) ? cut(thumb, 255) : null,
        type_document: typeOf(n, copies, n.niveau_biblio === "s"),
        nb_pages: pagesOf(n.npages),
        date_ajout: nullDate(n.create_date),
        ...extra,
      };
    };

    // ------------------------------------------------ Notices
    const doneNotices = await mapped("notice");
    const docs = [];
    let articles = 0;
    for (const n of S.notices) {
      if (doneNotices.has(n.notice_id)) continue;
      // Les dépouillements d'articles (niveau a) et les notices de bulletin (niveau b) sont rattachés aux numéros
      if (n.niveau_biblio === "a") { articles++; continue; }
      if (n.niveau_biblio === "b") continue;
      docs.push({ pmb: n.notice_id, row: docRow(n, explByNotice.get(n.notice_id)) });
    }
    // Numéros de revues ayant des exemplaires ou un document numérique
    const doneBulletins = await mapped("bulletin");
    const bulletinOfArticle = new Map(S.analysis.map((a) => [a.analysis_notice, a.analysis_bulletin]));
    const numBulletins = new Set(S.explnum.map((x) => x.explnum_bulletin || bulletinOfArticle.get(x.explnum_notice)).filter(Boolean));
    const bulletinsToImport = S.bulletins.filter((b) => !doneBulletins.has(b.bulletin_id) && (explByBulletin.has(b.bulletin_id) || numBulletins.has(b.bulletin_id)));
    const bulls = bulletinsToImport.map((b) => {
      const serial = noticeById.get(b.bulletin_notice) || {};
      const own = noticeById.get(b.num_notice);
      const base = own ? { ...own, tit1: clean(serial.tit1) || clean(own.tit1) } : { ...serial };
      const label = [clean(b.bulletin_numero), clean(b.bulletin_titre)].filter(Boolean).join(", ");
      const row = docRow({ ...base, notice_id: b.bulletin_notice || 0, tit4: "", year: b.date_date || base.year }, explByBulletin.get(b.bulletin_id), { type_document: "revue" });
      row.titre = cut(`${clean(serial.tit1) || "Revue"}${label ? ` — ${label}` : ""}`, 255);
      if (own) row.resume = clean(own.n_resume) || row.resume;
      return { pmb: b.bulletin_id, row };
    });
    if (articles) warn(`${articles} notice(s) d'article de revue non reprise(s) individuellement (le numéro de revue, lui, est repris).`);

    const allDocs = [...docs, ...bulls];
    const docIds = await reserveIds(t, "documents", allDocs.length);
    allDocs.forEach((d, i) => (d.id = docIds[i]));
    const docCols = ["id", "titre", "isbn", "auteur", "editeur", "annee", "langue", "categorie", "cote", "localisation", "resume", "mots_cles", "couleur", "couverture_url", "type_document", "nb_pages", "date_ajout", "disponible"];
    await bulkInsert(t, "documents", docCols, allDocs.map((d) => ({ ...d.row, id: d.id, disponible: 0, date_ajout: d.row.date_ajout || NOW })), 300);
    await saveMap("notice", docs.map((d) => [d.pmb, d.id]));
    await saveMap("bulletin", bulls.map((d) => [d.pmb, d.id]));
    const noticeMap = await mapped("notice");
    const bulletinMap = await mapped("bulletin");

    // Nouveaux domaines et localisations dans les référentiels
    for (const c of new Set(allDocs.map((d) => d.row.categorie))) await t.run("INSERT INTO categories (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [c]);
    for (const l of new Set(allDocs.map((d) => d.row.localisation).filter(Boolean))) await t.run("INSERT INTO locations (nom) VALUES (?) ON CONFLICT (nom) DO NOTHING", [cut(l, 150)]);

    // ------------------------------------------------ Exemplaires
    const doneExpl = await mapped("exemplaire");
    const usedCodes = new Set((await t.all("SELECT code_barre FROM document_copies")).map((r) => r.code_barre));
    const numByDoc = new Map((await t.all("SELECT document_id, MAX(numero_exemplaire) AS n FROM document_copies GROUP BY document_id")).map((r) => [r.document_id, r.n]));
    const copies = [];
    const statusCount = {};
    for (const e of S.expl) {
      if (doneExpl.has(e.expl_id)) continue;
      const docId = e.expl_notice > 0 ? noticeMap.get(e.expl_notice) : bulletinMap.get(e.expl_bulletin);
      if (!docId) { report.ignores.push(`Exemplaire ${e.expl_cb} : notice introuvable`); continue; }
      let code = cut(clean(e.expl_cb), 100) || `PMB-EX-${e.expl_id}`;
      if (usedCodes.has(code)) code = `PMB-${BASE}-${e.expl_id}`;
      usedCodes.add(code);
      const st = statById.get(e.expl_statut);
      const lib = clean(st?.statut_libelle).toLowerCase();
      let statut = "disponible";
      if (loanedExpl.has(e.expl_id)) statut = "emprunte";
      else if (/perdu|pilon|vol[ée]|d[ée]sherb/.test(lib)) statut = "perdu";
      else if (st && Number(st.pret_flag) !== 1) statut = "maintenance";
      statusCount[st ? clean(st.statut_libelle) : "?"] = (statusCount[st ? clean(st.statut_libelle) : "?"] || 0) + 1;
      const n = (numByDoc.get(docId) || 0) + 1;
      numByDoc.set(docId, n);
      copies.push({ pmb: e.expl_id, row: { document_id: docId, code_barre: code, numero_exemplaire: n, etat: "bon", statut, date_acquisition: nullDate(e.create_date) || nullDate(e.expl_date_depot) || NOW } });
    }
    const copyIds = await reserveIds(t, "document_copies", copies.length);
    copies.forEach((c, i) => (c.id = copyIds[i]));
    await bulkInsert(t, "document_copies", ["id", "document_id", "code_barre", "numero_exemplaire", "etat", "statut", "date_acquisition"],
      copies.map((c) => ({ id: c.id, ...c.row })), 500);
    await saveMap("exemplaire", copies.map((c) => [c.pmb, c.id]));
    const copyMap = await mapped("exemplaire");

    // ------------------------------------------------ Lecteurs
    const doneEmpr = await mapped("lecteur");
    const existingUsers = await t.all("SELECT id, lower(email) AS email, matricule FROM users");
    const byEmail = new Map(existingUsers.map((u) => [u.email, u.id]));
    const byMatricule = new Map(existingUsers.filter((u) => u.matricule).map((u) => [u.matricule, u.id]));
    const newUsers = [];
    const merged = [];
    let hashed = 0;
    for (const u of S.empr) {
      if (doneEmpr.has(u.id_empr)) continue;
      const matricule = cut(clean(u.empr_cb), 50) || `PMB-${u.id_empr}`;
      const mail = clean(u.empr_mail).split(/[;,\s]+/).find(isEmail)?.toLowerCase();
      const existing = (mail && byEmail.get(mail)) || byMatricule.get(matricule);
      if (existing) { merged.push([u.id_empr, existing]); continue; }
      const email = mail && !byEmail.has(mail) ? mail : `pmb-${BASE}-${u.id_empr}@sans-email.invalid`;
      byEmail.set(email, -1);
      byMatricule.set(matricule, -1);
      // Mot de passe PMB (en clair dans PMB 4) chiffré ; à défaut, le matricule
      const pw = String(u.empr_password ?? "");
      const plain = pw && !/^[a-f0-9]{32}$|^\$2[aby]\$/.test(pw) ? pw : matricule;
      if (pw && plain === matricule && pw !== matricule) warn(`Lecteur ${matricule} : mot de passe PMB chiffré, remplacé par le matricule.`);
      const statut = emprStatById.get(u.empr_statut) && Number(emprStatById.get(u.empr_statut).allow_loan) === 0 ? "suspendu" : "actif";
      newUsers.push({
        pmb: u.id_empr,
        plain,
        row: {
          nom: cut(clean(u.empr_nom), 255) || matricule,
          prenom: cut(clean(u.empr_prenom), 100),
          email,
          telephone: cut(clean(u.empr_tel1) || clean(u.empr_tel2), 50),
          matricule,
          filiere: cut(clean(u.empr_prof) || clean(emprCategById.get(u.empr_categ)?.libelle), 100),
          role: "adherent",
          statut,
          date_creation: nullDate(u.empr_creation) || nullDate(u.empr_date_adhesion) || NOW,
        },
      });
    }
    if (newUsers.length) log(`Chiffrement des mots de passe de ${newUsers.length} lecteur(s)…`);
    for (const nu of newUsers) {
      nu.row.mot_de_passe = await bcrypt.hash(nu.plain, 10);
      if (++hashed % 250 === 0) log(`  ${hashed}/${newUsers.length}`);
    }
    const userIds = await reserveIds(t, "users", newUsers.length);
    newUsers.forEach((u, i) => (u.id = userIds[i]));
    await bulkInsert(t, "users", ["id", "nom", "prenom", "email", "telephone", "matricule", "filiere", "role", "statut", "mot_de_passe", "date_creation"],
      newUsers.map((u) => ({ id: u.id, ...u.row })), 300);
    await saveMap("lecteur", [...newUsers.map((u) => [u.pmb, u.id]), ...merged]);
    const userMap = await mapped("lecteur");

    // ------------------------------------------------ Prêts en cours
    const exByIdAll = by(S.expl, "expl_id");
    const docOfExpl = (exId) => {
      const e = exByIdAll.get(exId);
      if (!e) return null;
      return e.expl_notice > 0 ? noticeMap.get(e.expl_notice) : bulletinMap.get(e.expl_bulletin);
    };
    const donePret = await mapped("pret");
    const loans = [];
    for (const p of S.pret) {
      const key = p.pret_arc_id || p.pret_idexpl; // un prêt en cours = un exemplaire
      if (donePret.has(key)) continue;
      const userId = userMap.get(p.pret_idempr), copyId = copyMap.get(p.pret_idexpl), docId = docOfExpl(p.pret_idexpl);
      if (!userId || !copyId || !docId) { report.ignores.push(`Prêt en cours (exemplaire ${p.pret_idexpl}) : lecteur ou exemplaire introuvable`); continue; }
      const due = nullDate(p.pret_retour);
      loans.push({
        pmb: key,
        row: {
          document_id: docId, copy_id: copyId, user_id: userId,
          date_emprunt: nullDate(p.pret_date) || NOW,
          date_retour_prevue: due ? (due.length === 10 ? `${due} 18:00:00` : due) : NOW,
          statut: "en_cours",
          renouvellements_count: Number(p.cpt_prolongation) || 0,
          notes: "Repris de PMB",
        },
      });
    }
    // ------------------------------------------------ Historique (prêts rendus)
    const doneArc = await mapped("pret_archive");
    let arcSkipped = 0;
    for (const a of S.archive) {
      if (doneArc.has(a.arc_id) || activeArcIds.has(a.arc_id)) continue;
      const fin = nullDate(a.arc_fin), debut = nullDate(a.arc_debut);
      const userId = userMap.get(a.arc_id_empr);
      const docId = docOfExpl(a.arc_expl_id) || noticeMap.get(a.arc_expl_notice) || bulletinMap.get(a.arc_expl_bulletin);
      if (!userId || !docId || !debut || !fin) { arcSkipped++; continue; }
      loans.push({
        pmb: a.arc_id,
        archive: true,
        row: {
          document_id: docId, copy_id: copyMap.get(a.arc_expl_id) || null, user_id: userId,
          date_emprunt: debut, date_retour_prevue: fin, date_retour_reelle: fin, statut: "retourne",
          renouvellements_count: Number(a.arc_cpt_prolongation) || 0, notes: "Historique PMB",
        },
      });
    }
    if (arcSkipped) warn(`${arcSkipped} prêt(s) de l'historique sans lecteur ou document existant (lecteurs supprimés dans PMB) : non repris.`);
    const loanIds = await reserveIds(t, "loans", loans.length);
    loans.forEach((l, i) => (l.id = loanIds[i]));
    await bulkInsert(t, "loans", ["id", "document_id", "copy_id", "user_id", "date_emprunt", "date_retour_prevue", "date_retour_reelle", "statut", "renouvellements_count", "notes"],
      loans.map((l) => ({ id: l.id, ...l.row })), 500);
    await t.run("UPDATE loans SET statut = 'en_retard' WHERE statut = 'en_cours' AND date_retour_prevue < app_now()");
    await saveMap("pret", loans.filter((l) => !l.archive).map((l) => [l.pmb, l.id]));
    await saveMap("pret_archive", loans.filter((l) => l.archive).map((l) => [l.pmb, l.id]));

    // ------------------------------------------------ Réservations
    const doneResa = await mapped("resa");
    const rang = new Map((await t.all("SELECT document_id, MAX(rang_file) AS r FROM reservations WHERE statut = 'en_attente' GROUP BY document_id")).map((r) => [r.document_id, r.r]));
    const resas = [];
    const copyByCode = new Map(copies.map((c) => [c.row.code_barre, c.id]));
    for (const r of S.resa) {
      if (doneResa.has(r.id_resa)) continue;
      const userId = userMap.get(r.resa_idempr);
      const docId = r.resa_idnotice ? noticeMap.get(r.resa_idnotice) : bulletinMap.get(r.resa_idbulletin);
      if (!userId || !docId) { report.ignores.push(`Réservation ${r.id_resa} : lecteur ou notice introuvable`); continue; }
      const assigned = clean(r.resa_cb);
      const ready = !!assigned && Number(r.resa_confirmee) === 1;
      const row = { document_id: docId, user_id: userId, date_reservation: nullDate(r.resa_date) || NOW, statut: ready ? "disponible" : "en_attente", rang_file: 1, date_expiration: ready ? ((d) => (d && d.length === 10 ? `${d} 18:00:00` : d))(nullDate(r.resa_date_fin)) : null };
      if (!ready) { const n = (rang.get(docId) || 0) + 1; rang.set(docId, n); row.rang_file = n; }
      if (ready && copyByCode.has(assigned)) await t.run("UPDATE document_copies SET statut = 'reserve' WHERE id = ? AND statut = 'disponible'", [copyByCode.get(assigned)]);
      resas.push({ pmb: r.id_resa, row });
    }
    const resaIds = await reserveIds(t, "reservations", resas.length);
    resas.forEach((r, i) => (r.id = resaIds[i]));
    await bulkInsert(t, "reservations", ["id", "document_id", "user_id", "date_reservation", "statut", "rang_file", "date_expiration"], resas.map((r) => ({ id: r.id, ...r.row })));
    await saveMap("resa", resas.map((r) => [r.pmb, r.id]));

    // ------------------------------------------------ Documents numériques
    const doneNum = await mapped("explnum");
    const repById = by(S.repertoires, "repertoire_id");
    const outDir = path.join(config.uploadDir, "documents");
    let numOk = 0;
    const findFile = (name) => {
      if (!FILES_DIR || !name) return null;
      const stack = [FILES_DIR];
      while (stack.length) {
        const d = stack.pop();
        let entries = [];
        try { entries = fss.readdirSync(d, { withFileTypes: true }); } catch { continue; }
        for (const e of entries) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) stack.push(p);
          else if (e.name === name) return p;
        }
      }
      return null;
    };
    for (const x of S.explnum) {
      if (doneNum.has(x.explnum_id)) continue;
      // Article de revue : le document numérique est rattaché au numéro qui le contient
      const docId = x.explnum_notice
        ? noticeMap.get(x.explnum_notice) || bulletinMap.get(bulletinOfArticle.get(x.explnum_notice))
        : bulletinMap.get(x.explnum_bulletin);
      if (!docId) { report.ignores.push(`Document numérique « ${clean(x.explnum_nom)} » : notice introuvable`); continue; }
      let value = null;
      const url = clean(x.explnum_url);
      if (/^https?:\/\//.test(url)) value = cut(url, 255);
      else {
        const name = clean(x.explnum_nomfichier) || clean(x.explnum_nom);
        const ext = (path.extname(name).slice(1) || clean(x.explnum_extfichier) || (/pdf/.test(x.explnum_mimetype) ? "pdf" : "")).toLowerCase();
        if (!["pdf", "epub"].includes(ext)) { report.ignores.push(`Document numérique « ${clean(x.explnum_nom)} » : format ${ext || x.explnum_mimetype} non géré`); continue; }
        let data = null;
        if (x.taille > 0) data = (await q("SELECT explnum_data FROM explnum WHERE explnum_id = ?", [x.explnum_id]))[0].explnum_data;
        else if (x.explnum_repertoire) {
          const rep = repById.get(x.explnum_repertoire);
          const direct = rep && path.join(clean(rep.repertoire_path), clean(x.explnum_path), name);
          const found = (direct && fss.existsSync(direct) && direct) || findFile(name);
          if (found) data = await fs.readFile(found);
        }
        if (!data) { report.ignores.push(`Document numérique « ${clean(x.explnum_nom)} » (${name}) : fichier introuvable${FILES_DIR ? "" : " — relancez avec --fichiers <dossier de l'ancien PMB>"}`); continue; }
        const file = `pmb_${BASE.replace(/[^a-z0-9]/gi, "")}_${x.explnum_id}.${ext}`;
        if (!DRY_RUN) {
          await fs.mkdir(outDir, { recursive: true });
          await fs.writeFile(path.join(outDir, file), data);
        }
        value = `/uploads/documents/${file}`;
      }
      const set = await t.run("UPDATE documents SET fichier_numerique = ? WHERE id = ? AND fichier_numerique IS NULL", [value, docId]);
      if (!set) warn(`Document numérique « ${clean(x.explnum_nom)} » : la notice a déjà un document numérique, celui-ci (${value}) n'est pas rattaché.`);
      await saveMap("explnum", [[x.explnum_id, docId]]);
      if (set) numOk++;
    }

    // ------------------------------------------------ Mémoires et thèses : aussi visibles dans l'onglet « Mémoires »
    const doneMem = await mapped("memoire");
    const memDocs = allDocs.filter((d) => ["memoire", "these"].includes(d.row.type_document) && !doneMem.has(d.id));
    const memPairs = [];
    for (const d of memDocs) {
      const cur = await t.one("SELECT fichier_numerique FROM documents WHERE id = ?", [d.id]);
      const text = `${d.row.titre} ${d.row.resume || ""} ${d.row.mots_cles || ""}`;
      const cycle = d.row.type_document === "these" || /doctora|th[èe]se/i.test(text) ? "Doctorat" : /licence/i.test(text) ? "Licence" : "Master";
      const id = await t.insert(
        `INSERT INTO digital_resources (document_id, titre, auteur, filiere, cycle, annee_academique, session_soutenance, note_mention, resume, mots_cles, fichier_path, telechargeable)
         VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, 1)`,
        [d.id, d.row.titre, d.row.auteur, d.row.categorie, cycle, d.row.annee ? String(d.row.annee) : "", d.row.resume || "", d.row.mots_cles || "", cur?.fichier_numerique || null]
      );
      memPairs.push([d.id, id]);
    }
    await saveMap("memoire", memPairs);

    // ------------------------------------------------ Disponibilité des notices importées
    await t.run(
      `UPDATE documents d SET disponible = CASE WHEN EXISTS (SELECT 1 FROM document_copies c WHERE c.document_id = d.id AND c.statut = 'disponible') THEN 1 ELSE 0 END
       WHERE d.id IN (SELECT new_id FROM pmb_import_map WHERE entite IN ('notice','bulletin') AND base = ?)`,
      [BASE]
    );

    // Prêts repris déjà en retard : le traitement de nuit suspendrait leurs lecteurs
    const oldLate = await t.one(
      `SELECT COUNT(*) AS prets, COUNT(DISTINCT l.user_id) AS lecteurs FROM loans l
       JOIN pmb_import_map m ON m.entite = 'pret' AND m.base = ? AND m.new_id = l.id
       WHERE l.statut = 'en_retard' AND app_now() - l.date_retour_prevue > make_interval(days => ?)`,
      [BASE, Number((await t.val("SELECT valeur FROM settings WHERE cle = 'jours_retard_suspension'")) || 10)]
    );
    if (oldLate.prets > 0) {
      warn(`${oldLate.prets} prêt(s) repris sont en retard au-delà du seuil de suspension (${oldLate.lecteurs} lecteur(s)). ` +
        "Le traitement de nuit suspendrait ces comptes : vérifiez la page « Retards » de l'admin (rendre ou passer en perdu) avant d'activer CRON_ENABLED.");
    }

    // ------------------------------------------------ Bilan
    const bilan = {
      base: BASE,
      notices: docs.length,
      numeros_revues: bulls.length,
      exemplaires: copies.length,
      lecteurs_crees: newUsers.length,
      lecteurs_fusionnes: merged.length,
      prets_en_cours: loans.filter((l) => !l.archive).length,
      historique_prets: loans.filter((l) => l.archive).length,
      reservations: resas.length,
      documents_numeriques: numOk,
      memoires: memPairs.length,
      statuts_exemplaires_pmb: statusCount,
    };
    await logActivity(t, null, `Reprise des données PMB (base ${BASE})`, { cibleType: "import", details: { ...bilan, ignores: report.ignores.slice(0, 100) }, user: { id: null, nom: "Import PMB", role: "systeme" } });

    log("\n================ Bilan de la reprise PMB ================");
    log(`Base PMB : ${BASE}${DRY_RUN ? "   (ESSAI : rien n'a été enregistré)" : ""}`);
    log(`  Notices importées ............ ${bilan.notices}`);
    log(`  Numéros de revues ............ ${bilan.numeros_revues}`);
    log(`  Exemplaires .................. ${bilan.exemplaires}`);
    log(`  Lecteurs créés ............... ${bilan.lecteurs_crees}`);
    log(`  Lecteurs déjà présents ....... ${bilan.lecteurs_fusionnes} (reliés, non modifiés)`);
    log(`  Prêts en cours ............... ${bilan.prets_en_cours}`);
    log(`  Historique des prêts ......... ${bilan.historique_prets}`);
    log(`  Réservations ................. ${bilan.reservations}`);
    log(`  Documents numériques ......... ${bilan.documents_numeriques}`);
    log(`  Mémoires et thèses ........... ${bilan.memoires} (aussi dans l'onglet « Mémoires »)`);
    log(`  Statuts d'exemplaires PMB .... ${Object.entries(statusCount).map(([k, v]) => `${k} : ${v}`).join(", ") || "-"}`);
    for (const a of report.avertissements) log(`  ⚠ ${a}`);
    if (report.ignores.length) {
      log(`  ${report.ignores.length} élément(s) non repris :`);
      for (const i of report.ignores.slice(0, 30)) log(`    - ${i}`);
      if (report.ignores.length > 30) log(`    … (liste complète dans le journal d'activité)`);
    }
    log(`Durée : ${Math.round((Date.now() - started) / 1000)} s`);
    if (DRY_RUN) throw Object.assign(new Error("ESSAI"), { dryRun: true });
  });
  if (!DRY_RUN) log("Reprise enregistrée. Les lecteurs se connectent avec leur code-barres PMB (matricule) et leur mot de passe de l'ancien portail.");
} catch (e) {
  if (!e.dryRun) {
    console.error("\n✘ Reprise interrompue, rien n'a été enregistré :", e.message);
    process.exitCode = 1;
  } else log("Essai terminé : relancez sans --essai pour enregistrer.");
} finally {
  await src.end();
  await pool.end();
}
