// Prêts, demandes d'emprunt, réservations, prolongations, favoris et notifications.
import { Router } from "express";
import { db, tx, setting, frDate } from "../db.js";
import { ah, fail, CirculationError } from "../errors.js";
import { requireAuth, requireStaff, isStaff, resolveUserId } from "../auth.js";
import { logActivity } from "../logger.js";
import { createLoan, returnLoan, markOverdueLoans, assertCanBorrow, expireReservations } from "../circulation.js";

const r = Router();
const int = (v) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0);
const str = (v) => (v === undefined || v === null ? "" : String(v)).trim();

// ================================================================ /api/loans
//  GET  : personnel = tous les prêts (filtres user_id, statut) ; lecteur = ses propres prêts
//  POST : prêt (personnel) — par document_id/user_id ou par code-barres + matricule/email
//  PUT  : retour (personnel) — par id de prêt ou par code-barres d'exemplaire

r.get("/loans", ah(async (req, res) => {
  const me = requireAuth(req);
  await markOverdueLoans(db);
  const userId = resolveUserId(me, req.query.user_id);
  let sql = `
    SELECT l.*, d.titre, d.auteur, d.categorie, d.couleur, d.cote, d.localisation,
           c.code_barre, c.numero_exemplaire,
           u.nom AS user_name, u.prenom AS user_prenom, u.email AS user_email, u.telephone AS user_telephone,
           u.matricule AS user_matricule, u.statut AS user_statut,
           (l.date_retour_prevue::date - app_now()::date) AS jours_restants,
           GREATEST(0, app_now()::date - l.date_retour_prevue::date) AS jours_retard
    FROM loans l
    JOIN documents d ON l.document_id = d.id
    JOIN users u ON l.user_id = u.id
    LEFT JOIN document_copies c ON l.copy_id = c.id
    WHERE 1=1`;
  const params = [];
  if (userId) { sql += " AND l.user_id = ?"; params.push(userId); }
  if (req.query.statut) { sql += " AND l.statut = ?"; params.push(String(req.query.statut)); }
  sql += " ORDER BY l.date_emprunt DESC, l.id DESC";
  res.json(await db.all(sql, params));
}));

r.post("/loans", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  let documentId = int(d.document_id), userId = int(d.user_id), copyId = int(d.copy_id) || null;

  // Prêt rapide au comptoir : code-barres de l'exemplaire
  if (str(d.code_barre)) {
    const cp = await db.one("SELECT id, document_id FROM document_copies WHERE code_barre = ?", [str(d.code_barre)]);
    if (!cp) fail("Aucun exemplaire ne correspond à ce code-barres.", 404);
    copyId = cp.id;
    documentId = cp.document_id;
  }
  // Lecteur identifié par matricule ou email (carte de lecteur)
  if (!userId && str(d.lecteur)) {
    userId = int(await db.val("SELECT id FROM users WHERE matricule = ? OR lower(email) = lower(?) LIMIT 1", [str(d.lecteur), str(d.lecteur)]));
    if (!userId) fail("Aucun lecteur ne correspond à ce matricule / email.", 404);
  }
  if (!documentId || !userId) fail("Document (ou code-barres) et lecteur requis");

  const loan = await tx((t) => createLoan(t, req, documentId, userId, copyId, d.days ?? null));
  res.json({ success: true, id: loan.id, date_retour_prevue: loan.date_retour_prevue, titre: loan.titre });
}));

r.put("/loans", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  let loanId = int(d.id);
  if (!loanId && str(d.code_barre)) {
    loanId = int(await db.val(
      `SELECT l.id FROM loans l JOIN document_copies c ON c.id = l.copy_id
       WHERE c.code_barre = ? AND l.statut IN ('en_cours','en_retard') ORDER BY l.id DESC LIMIT 1`,
      [str(d.code_barre)]
    ));
    if (!loanId) fail("Aucun prêt en cours pour cet exemplaire.", 404);
  }
  if (!loanId) fail("Identifiant du prêt ou code-barres requis");
  const out = await tx((t) => returnLoan(t, req, loanId));
  res.json({ success: true, ...out });
}));

// ================================================================ /api/borrow-requests

r.get("/borrow-requests", ah(async (req, res) => {
  const me = requireAuth(req);
  const userId = resolveUserId(me, req.query.user_id);
  let sql = `
    SELECT r.*, d.titre, d.auteur, d.categorie, d.couleur, d.cote, d.localisation,
           u.nom AS user_nom, u.prenom AS user_prenom, u.email AS user_email, u.matricule AS user_matricule, u.filiere AS user_filiere
    FROM borrow_requests r JOIN documents d ON r.document_id = d.id JOIN users u ON r.user_id = u.id
    WHERE 1=1`;
  const params = [];
  if (userId) { sql += " AND r.user_id = ?"; params.push(userId); }
  if (req.query.statut) { sql += " AND r.statut = ?"; params.push(String(req.query.statut)); }
  sql += " ORDER BY r.date_demande DESC, r.id DESC";
  res.json(await db.all(sql, params));
}));

r.post("/borrow-requests", ah(async (req, res) => {
  const me = requireAuth(req);
  const d = req.body || {};
  const documentId = int(d.document_id);
  const userId = resolveUserId(me, d.user_id) || Number(me.id);
  if (!documentId) fail("Document requis");

  const reqId = await tx(async (t) => {
    // Mêmes règles qu'un prêt au comptoir (statut du compte, retards, quota)
    await assertCanBorrow(t, userId);
    if ((await t.val("SELECT COUNT(*) FROM borrow_requests WHERE user_id = ? AND document_id = ? AND statut = 'en_attente'", [userId, documentId])) > 0) {
      throw new CirculationError("Vous avez déjà une demande en cours pour cet ouvrage.");
    }
    const pending = await t.val("SELECT COUNT(*) FROM borrow_requests WHERE user_id = ? AND statut = 'en_attente'", [userId]);
    const active = await t.val("SELECT COUNT(*) FROM loans WHERE user_id = ? AND statut IN ('en_cours','en_retard')", [userId]);
    const max = Number(await setting("max_emprunts_simultanes", 3, t));
    if (pending + active >= max) throw new CirculationError(`Quota atteint : ${max} emprunts (en cours + demandes en attente) maximum.`);
    if (!(await t.val("SELECT COUNT(*) FROM document_copies WHERE document_id = ? AND statut = 'disponible'", [documentId]))) {
      throw new CirculationError("Aucun exemplaire disponible actuellement : vous pouvez réserver ce document.");
    }
    const id = await t.insert("INSERT INTO borrow_requests (document_id, user_id, statut) VALUES (?, ?, 'en_attente')", [documentId, userId]);
    const titre = await t.val("SELECT titre FROM documents WHERE id = ?", [documentId]);
    await t.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Demande d''emprunt transmise', ?, 'emprunt')", [
      userId, `Votre demande pour « ${titre} » a été transmise à la bibliothèque. Vous serez prévenu dès sa validation.`,
    ]);
    await logActivity(t, req, `Demande d'emprunt pour « ${titre} »`, { cibleType: "borrow_request", cibleId: id, details: { document_id: documentId } });
    return id;
  });
  res.json({ success: true, id: reqId });
}));

r.put("/borrow-requests", ah(async (req, res) => {
  const staff = requireStaff(req);
  const d = req.body || {};
  const id = int(d.id);
  const action = d.action;
  if (!id || !["approve", "reject"].includes(action)) fail("Action invalide ou identifiant manquant");

  await tx(async (t) => {
    const rq = await t.one(
      "SELECT r.*, d.titre FROM borrow_requests r JOIN documents d ON r.document_id = d.id WHERE r.id = ? FOR UPDATE OF r",
      [id]
    );
    if (!rq || rq.statut !== "en_attente") throw new CirculationError("Cette demande n'est plus en attente.");

    if (action === "approve") {
      const loan = await createLoan(t, req, rq.document_id, rq.user_id);
      await t.run("UPDATE borrow_requests SET statut = 'validee', date_traitement = app_now(), bibliothecaire_id = ? WHERE id = ?", [staff.id, id]);
      await t.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Demande d''emprunt validée', ?, 'emprunt')", [
        rq.user_id, `Votre demande pour « ${rq.titre} » est validée : l'ouvrage vous attend à l'accueil. Retour prévu le ${frDate(loan.date_retour_prevue)}.`,
      ]);
      await logActivity(t, req, `Demande d'emprunt validée : « ${rq.titre} »`, { cibleType: "borrow_request", cibleId: id, details: { loan_id: loan.id } });
    } else {
      const motif = str(d.motif_refus) || "Document non disponible pour le prêt.";
      await t.run(
        "UPDATE borrow_requests SET statut = 'refusee', motif_refus = ?, date_traitement = app_now(), bibliothecaire_id = ? WHERE id = ?",
        [motif, staff.id, id]
      );
      await t.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Demande d''emprunt refusée', ?, 'info')", [
        rq.user_id, `Votre demande pour « ${rq.titre} » a été refusée. Motif : ${motif}`,
      ]);
      await logActivity(t, req, `Demande d'emprunt refusée : « ${rq.titre} »`, { cibleType: "borrow_request", cibleId: id, details: { motif } });
    }
  });
  res.json({ success: true });
}));

// Le lecteur peut retirer sa propre demande tant qu'elle n'est pas traitée
r.delete("/borrow-requests", ah(async (req, res) => {
  const me = requireAuth(req);
  const id = int(req.query.id);
  if (!id) fail("Identifiant manquant");
  const rq = await db.one("SELECT r.*, d.titre FROM borrow_requests r JOIN documents d ON d.id = r.document_id WHERE r.id = ?", [id]);
  if (!rq) fail("Demande introuvable", 404);
  if (!isStaff(me) && Number(rq.user_id) !== Number(me.id)) fail("Vous ne pouvez annuler que vos propres demandes.", 403);
  if (rq.statut !== "en_attente") fail("Cette demande a déjà été traitée.");
  await db.run("DELETE FROM borrow_requests WHERE id = ?", [id]);
  await logActivity(db, req, `Annulation de la demande d'emprunt pour « ${rq.titre} »`, { cibleType: "borrow_request", cibleId: id });
  res.json({ success: true });
}));

// ================================================================ /api/reservations

r.get("/reservations", ah(async (req, res) => {
  const me = requireAuth(req);
  await tx((t) => expireReservations(t));
  const userId = resolveUserId(me, req.query.user_id);
  let sql = `
    SELECT r.*, d.titre, d.auteur, d.categorie, d.couleur, d.cote, d.localisation,
           u.nom AS user_nom, u.prenom AS user_prenom, u.email AS user_email
    FROM reservations r JOIN documents d ON r.document_id = d.id JOIN users u ON r.user_id = u.id
    WHERE 1=1`;
  const params = [];
  if (userId) { sql += " AND r.user_id = ?"; params.push(userId); }
  if (int(req.query.document_id)) { sql += " AND r.document_id = ?"; params.push(int(req.query.document_id)); }
  sql += " ORDER BY r.document_id, r.rang_file ASC, r.date_reservation ASC";
  res.json(await db.all(sql, params));
}));

r.post("/reservations", ah(async (req, res) => {
  const me = requireAuth(req);
  const d = req.body || {};
  const documentId = int(d.document_id);
  const userId = resolveUserId(me, d.user_id) || Number(me.id);
  if (!documentId) fail("Document requis");

  const out = await tx(async (t) => {
    const st = await t.val("SELECT statut FROM users WHERE id = ?", [userId]);
    if (!st) fail("Lecteur introuvable", 404);
    if (st === "suspendu") fail("Compte suspendu : réservation impossible.", 403);
    if ((await t.val("SELECT COUNT(*) FROM reservations WHERE document_id = ? AND user_id = ? AND statut IN ('en_attente','disponible')", [documentId, userId])) > 0) {
      fail("Vous avez déjà une réservation active sur cet ouvrage.");
    }
    if ((await t.val("SELECT COUNT(*) FROM loans WHERE document_id = ? AND user_id = ? AND statut IN ('en_cours','en_retard')", [documentId, userId])) > 0) {
      fail("Vous avez déjà cet ouvrage en prêt.");
    }
    // Verrou sur la notice : deux réservations simultanées ne peuvent pas obtenir le même rang
    const titre = await t.val("SELECT titre FROM documents WHERE id = ? FOR UPDATE", [documentId]);
    if (!titre) fail("Document introuvable", 404);
    const rang = await t.val("SELECT COALESCE(MAX(rang_file), 0) + 1 FROM reservations WHERE document_id = ? AND statut = 'en_attente'", [documentId]);
    const id = await t.insert("INSERT INTO reservations (document_id, user_id, rang_file, statut) VALUES (?, ?, ?, 'en_attente')", [documentId, userId, rang]);
    await t.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Réservation enregistrée', ?, 'reservation')", [
      userId, `Votre réservation pour « ${titre} » est enregistrée (position ${rang} dans la file). Vous serez prévenu dès qu'un exemplaire sera disponible.`,
    ]);
    await logActivity(t, req, `Réservation de « ${titre} » (rang ${rang})`, { cibleType: "reservation", cibleId: id, details: { document_id: documentId, user_id: userId } });
    return { id, rang };
  });
  res.json({ success: true, ...out });
}));

r.delete("/reservations", ah(async (req, res) => {
  const me = requireAuth(req);
  const id = int(req.query.id);
  if (!id) fail("Identifiant manquant");
  const rs = await db.one("SELECT r.*, d.titre FROM reservations r JOIN documents d ON r.document_id = d.id WHERE r.id = ?", [id]);
  if (!rs) fail("Réservation introuvable", 404);
  if (!isStaff(me) && Number(rs.user_id) !== Number(me.id)) fail("Vous ne pouvez annuler que vos propres réservations.", 403);
  if (!["en_attente", "disponible"].includes(rs.statut)) return res.json({ success: true });

  await tx(async (t) => {
    if (rs.statut === "en_attente") {
      await t.run("UPDATE reservations SET statut = 'annulee' WHERE id = ?", [id]);
      await t.run("UPDATE reservations SET rang_file = rang_file - 1 WHERE document_id = ? AND statut = 'en_attente' AND rang_file > ?", [rs.document_id, rs.rang_file]);
    } else {
      // Réservation déjà disponible : on la fait expirer, l'exemplaire mis de côté passe au suivant
      await t.run("UPDATE reservations SET date_expiration = app_now() - interval '1 second' WHERE id = ?", [id]);
      await expireReservations(t);
    }
    await logActivity(t, req, `Annulation de la réservation de « ${rs.titre} »`, { cibleType: "reservation", cibleId: id });
  });
  res.json({ success: true });
}));

// ================================================================ /api/renewals (prolongation)

r.post("/renewals", ah(async (req, res) => {
  const me = requireAuth(req);
  const loanId = int(req.body?.loan_id);
  if (!loanId) fail("Identifiant du prêt requis");

  const out = await tx(async (t) => {
    const loan = await t.one(
      "SELECT l.*, d.titre, (l.date_retour_prevue < app_now()) AS echu FROM loans l JOIN documents d ON l.document_id = d.id WHERE l.id = ? FOR UPDATE OF l",
      [loanId]
    );
    if (!loan) fail("Prêt introuvable", 404);
    if (!isStaff(me) && Number(loan.user_id) !== Number(me.id)) fail("Ce prêt ne vous appartient pas.", 403);
    if (loan.statut !== "en_cours") fail("Seul un prêt en cours (non rendu, non en retard) peut être prolongé.");
    if (loan.echu) fail("Impossible de prolonger un document en retard. Merci de le rapporter à la bibliothèque.");
    const max = Number(await setting("max_renouvellements", 2, t));
    if (loan.renouvellements_count >= max) fail(`Nombre maximal de prolongations atteint (${max}).`);
    if ((await t.val("SELECT COUNT(*) FROM reservations WHERE document_id = ? AND statut = 'en_attente'", [loan.document_id])) > 0) {
      fail("Cet ouvrage est réservé par un autre lecteur : prolongation impossible.");
    }
    const days = Number(await setting("jours_prolongation", 7, t));
    const newCount = loan.renouvellements_count + 1;
    const newDate = await t.val(
      "UPDATE loans SET date_retour_prevue = date_retour_prevue + make_interval(days => ?), renouvellements_count = ? WHERE id = ? RETURNING date_retour_prevue",
      [days, newCount, loanId]
    );
    await t.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, ?, ?, 'rappel')", [
      loan.user_id, `Prolongation accordée (+${days} jours)`,
      `Le prêt de « ${loan.titre} » est prolongé jusqu'au ${frDate(newDate)} (${newCount}/${max} prolongations).`,
    ]);
    await logActivity(t, req, `Prolongation (+${days} j) de « ${loan.titre} »`, { cibleType: "loan", cibleId: loanId, details: { new_date: newDate } });
    return { new_date_retour: newDate, renouvellements_count: newCount, message: `Prolongation de ${days} jours accordée !` };
  });
  res.json({ success: true, ...out });
}));

// ================================================================ /api/favorites (lecteur connecté)

r.get("/favorites", ah(async (req, res) => {
  const me = requireAuth(req);
  res.json(await db.all(
    `SELECT d.*, f.id AS fav_id, f.date_ajout AS date_favori,
            (SELECT COUNT(*) FROM document_copies c WHERE c.document_id = d.id AND c.statut = 'disponible') AS copies_disponibles
     FROM favorites f JOIN documents d ON f.document_id = d.id
     WHERE f.user_id = ? ORDER BY f.date_ajout DESC, f.id DESC`,
    [me.id]
  ));
}));

r.post("/favorites", ah(async (req, res) => {
  const me = requireAuth(req);
  const documentId = int(req.body?.document_id);
  if (!documentId) fail("Document requis");
  await db.run("INSERT INTO favorites (user_id, document_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [me.id, documentId]);
  res.json({ success: true });
}));

r.delete("/favorites", ah(async (req, res) => {
  const me = requireAuth(req);
  const documentId = int(req.query.document_id);
  if (!documentId) fail("Document requis");
  await db.run("DELETE FROM favorites WHERE user_id = ? AND document_id = ?", [me.id, documentId]);
  res.json({ success: true });
}));

// ================================================================ /api/notifications

r.get("/notifications", ah(async (req, res) => {
  const me = requireAuth(req);
  const userId = Number(me.id);

  // Alerte de retard automatique (une par document et par jour)
  if ((await setting("alerte_retard_active", "1")) === "1") {
    const late = await db.all(
      `SELECT l.id, d.titre, (app_now()::date - l.date_retour_prevue::date) AS jours_retard
       FROM loans l JOIN documents d ON l.document_id = d.id
       WHERE l.user_id = ? AND l.statut IN ('en_cours','en_retard') AND l.date_retour_prevue < app_now()`,
      [userId]
    );
    for (const ll of late) {
      const titre = `Retard sur « ${ll.titre} »`;
      await db.run(
        `INSERT INTO notifications (user_id, titre, message, type)
         SELECT ?, ?, ?, 'retard' WHERE NOT EXISTS (
           SELECT 1 FROM notifications WHERE user_id = ? AND type = 'retard' AND titre = ? AND date_creation::date = app_now()::date)`,
        [userId, titre, `Votre emprunt a ${ll.jours_retard} jour(s) de retard. Merci de le rapporter à l'accueil de la bibliothèque.`, userId, titre]
      );
    }
  }

  const notifications = await db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY date_creation DESC, id DESC LIMIT 50", [userId]);
  const unread = await db.val("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND lu = 0", [userId]);
  res.json({ notifications, unread_count: unread });
}));

r.put("/notifications", ah(async (req, res) => {
  const me = requireAuth(req);
  const d = req.body || {};
  if (d.action === "mark_all_read") {
    await db.run("UPDATE notifications SET lu = 1 WHERE user_id = ?", [me.id]);
    return res.json({ success: true });
  }
  const id = int(d.id);
  if (!id) fail("Paramètres invalides");
  await db.run("UPDATE notifications SET lu = 1 WHERE id = ? AND user_id = ?", [id, me.id]);
  res.json({ success: true });
}));

// Relance / message envoyé par le personnel à un lecteur
r.post("/notifications", ah(async (req, res) => {
  requireStaff(req);
  const d = req.body || {};
  const userId = int(d.user_id), titre = str(d.titre), message = str(d.message);
  const type = ["rappel", "retard", "reservation", "emprunt", "systeme", "info"].includes(d.type) ? d.type : "info";
  if (!userId || !titre || !message) fail("Destinataire, titre et message obligatoires");
  const id = await db.insert("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, ?, ?, ?)", [userId, titre, message, type]);
  await logActivity(db, req, `Relance envoyée : ${titre}`, { cibleType: "notification", cibleId: id, details: { destinataire: userId } });
  res.json({ success: true, id });
}));

export default r;
