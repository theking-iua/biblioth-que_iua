// Statistiques, alertes temps réel, paramètres, traitement quotidien et journal d'audit.
import { Router } from "express";
import { db, tx, invalidateSettings } from "../db.js";
import { ah, fail } from "../errors.js";
import { requireAuth, requireStaff, requireAdmin, isStaff } from "../auth.js";
import { logActivity } from "../logger.js";
import { runDailyProcessing } from "../circulation.js";

const r = Router();

// ================================================================ /api/dashboard-stats
// Public : quelques compteurs (page d'accueil). Personnel : tableau de bord complet.
r.get("/dashboard-stats", ah(async (req, res) => {
  const counts = await db.one(`
    SELECT (SELECT COUNT(*) FROM documents) AS total_documents,
           (SELECT COUNT(*) FROM document_copies) AS total_copies,
           (SELECT COUNT(*) FROM document_copies WHERE statut = 'disponible') AS copies_disponibles,
           (SELECT COUNT(*) FROM digital_resources) AS total_memoires,
           (SELECT COUNT(*) FROM users WHERE role IN ('adherent','visiteur')) AS total_adherents`);
  if (!isStaff(req.user)) return res.json(counts);

  const more = await db.one(`
    SELECT (SELECT COUNT(*) FROM loans WHERE statut = 'en_cours' AND date_retour_prevue >= app_now()) AS emprunts_en_cours,
           (SELECT COUNT(*) FROM loans WHERE statut = 'en_retard' OR (statut = 'en_cours' AND date_retour_prevue < app_now())) AS retards,
           (SELECT COUNT(*) FROM reservations WHERE statut IN ('en_attente','disponible')) AS reservations_actives,
           (SELECT COUNT(*) FROM borrow_requests WHERE statut = 'en_attente') AS demandes_en_attente,
           (SELECT COUNT(*) FROM users WHERE role IN ('adherent','visiteur') AND date_creation >= app_now() - interval '30 days') AS nouveaux_adherents`);

  const [top_documents, categories_stats, filieres_stats, heures_affluence] = await Promise.all([
    db.all(`SELECT d.id, d.titre, d.auteur, d.categorie, d.couleur, COUNT(l.id) AS nb_prets
            FROM documents d LEFT JOIN loans l ON d.id = l.document_id
            GROUP BY d.id ORDER BY nb_prets DESC, d.date_ajout DESC LIMIT 5`),
    db.all("SELECT categorie, COUNT(*) AS count FROM documents GROUP BY categorie ORDER BY count DESC"),
    db.all(`SELECT u.filiere, COUNT(l.id) AS total_emprunts FROM users u JOIN loans l ON u.id = l.user_id
            WHERE u.filiere IS NOT NULL AND u.filiere <> '' GROUP BY u.filiere ORDER BY total_emprunts DESC`),
    db.all("SELECT EXTRACT(HOUR FROM date)::int AS heure, COUNT(*) AS trafic FROM activity_logs GROUP BY 1 ORDER BY 1"),
  ]);

  res.json({
    ...counts,
    ...more,
    copies_empruntees: counts.total_copies - counts.copies_disponibles,
    top_documents,
    categories_stats,
    filieres_stats,
    heures_affluence,
  });
}));

// ================================================================ /api/realtime-alerts (compteurs pour le personnel)
r.get("/realtime-alerts", ah(async (req, res) => {
  requireStaff(req);
  const c = await db.one(`
    SELECT (SELECT COUNT(*) FROM borrow_requests WHERE statut = 'en_attente') AS demandes_en_attente,
           (SELECT COUNT(*) FROM loans WHERE statut = 'en_retard' OR (statut = 'en_cours' AND date_retour_prevue < app_now())) AS retards_critiques,
           (SELECT COUNT(*) FROM reservations WHERE statut IN ('en_attente','disponible')) AS reservations_actives,
           (SELECT COUNT(*) FROM loans WHERE statut = 'en_cours' AND date_retour_prevue >= app_now()) AS emprunts_en_cours,
           (SELECT COUNT(*) FROM borrow_requests WHERE statut = 'en_attente' AND date_demande >= app_now() - interval '2 hours') AS nouvelles_demandes`);
  const last_events = await db.all(`
    SELECT * FROM (
      SELECT 'demande' AS type, r.id, u.nom AS user_nom, u.prenom AS user_prenom, d.titre, r.date_demande AS date_event, r.statut
      FROM borrow_requests r JOIN users u ON r.user_id = u.id JOIN documents d ON r.document_id = d.id
      WHERE r.date_demande >= app_now() - interval '24 hours'
      UNION ALL
      SELECT 'emprunt' AS type, l.id, u.nom, u.prenom, d.titre, l.date_emprunt, l.statut
      FROM loans l JOIN users u ON l.user_id = u.id JOIN documents d ON l.document_id = d.id
      WHERE l.date_emprunt >= app_now() - interval '24 hours'
    ) ev ORDER BY date_event DESC LIMIT 8`);
  res.json({ ...c, last_events, timestamp: new Date().toISOString() });
}));

// ================================================================ /api/settings
// GET : public (les lecteurs voient les règles de prêt) — PUT : administrateurs
const EDITABLE = {
  duree_pret_jours: ["int", 1, 120],
  max_emprunts_simultanes: ["int", 1, 50],
  max_renouvellements: ["int", 0, 10],
  jours_prolongation: ["int", 1, 60],
  delai_recuperation_reservation_heures: ["int", 1, 720],
  jours_retard_suspension: ["int", 1, 365],
  nom_bibliotheque: ["str", 3, 150],
  email_contact: ["email"],
  alerte_retard_active: ["bool"],
};

r.get("/settings", ah(async (_req, res) => {
  const rows = await db.all("SELECT cle, valeur FROM settings");
  res.json(Object.fromEntries(rows.filter((x) => EDITABLE[x.cle]).map((x) => [x.cle, x.valeur])));
}));

r.put("/settings", ah(async (req, res) => {
  requireAdmin(req);
  const changed = {};
  for (const [key, raw] of Object.entries(req.body || {})) {
    const rule = EDITABLE[key];
    if (!rule) continue;
    let value = raw;
    switch (rule[0]) {
      case "int": {
        const n = Number(value);
        if (!Number.isFinite(n) || Math.trunc(n) < rule[1] || Math.trunc(n) > rule[2]) fail(`Valeur invalide pour ${key} (entre ${rule[1]} et ${rule[2]}).`);
        value = String(Math.trunc(n));
        break;
      }
      case "str":
        value = String(value ?? "").trim();
        if (value.length < rule[1] || value.length > rule[2]) fail(`Valeur invalide pour ${key}.`);
        break;
      case "email":
        value = String(value ?? "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) fail("Adresse email de contact invalide.");
        break;
      case "bool":
        value = [true, 1, "1", "true", "on", "yes", "oui"].includes(typeof value === "string" ? value.toLowerCase() : value) ? "1" : "0";
        break;
    }
    changed[key] = value;
  }
  await tx(async (t) => {
    for (const [k, v] of Object.entries(changed)) {
      await t.run("INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur", [k, v]);
    }
    await logActivity(t, req, "Modification des paramètres du SIGB", { cibleType: "settings", details: changed });
  });
  invalidateSettings();
  res.json({ success: true });
}));

// ================================================================ /api/daily-processing (bouton « Lancer le traitement des retards »)
r.post("/daily-processing", ah(async (req, res) => {
  requireAdmin(req);
  const out = await tx((t) => runDailyProcessing(t, req));
  res.json({ success: true, message: out.message });
}));

// ================================================================ /api/activity-logs
r.get("/activity-logs", ah(async (req, res) => {
  requireAdmin(req);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 500));
  let sql = `
    SELECT l.id, l.user_id, COALESCE(l.user_name, u.nom, 'Système / Invité') AS user_name,
           COALESCE(l.user_role, u.role, 'visiteur') AS user_role,
           l.action, l.cible_type, l.cible_id, l.details, l.ip_address, l.date
    FROM activity_logs l LEFT JOIN users u ON l.user_id = u.id
    WHERE 1=1`;
  const params = [];
  if (req.query.action) { sql += " AND f_unaccent(l.action) LIKE f_unaccent(?)"; params.push(`%${req.query.action}%`); }
  if (req.query.role) { sql += " AND (l.user_role = ? OR u.role = ?)"; params.push(String(req.query.role), String(req.query.role)); }
  sql += ` ORDER BY l.date DESC, l.id DESC LIMIT ${limit}`;
  res.json(await db.all(sql, params));
}));

// Événement explicite envoyé par une interface : toujours attribué à l'utilisateur connecté
r.post("/activity-logs", ah(async (req, res) => {
  requireAuth(req);
  const d = req.body || {};
  const action = String(d.action ?? "").trim();
  if (!action) fail("Action obligatoire");
  const ok = await logActivity(db, req, action, { cibleType: d.cible_type ?? null, cibleId: Number(d.cible_id) || null, details: d.details ?? null });
  res.json({ success: ok });
}));

export default r;
