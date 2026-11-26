// circulation.js : règles de prêt et de retour, partagées par loans, borrow-requests, reservations et le cron.
// Les paramètres (durée, quota, délais) viennent de la table settings.
import { setting, frDate } from "./db.js";
import { CirculationError } from "./errors.js";
import { logActivity } from "./logger.js";

/** Met à jour la disponibilité globale d'une notice d'après ses exemplaires. */
export async function refreshDocumentAvailability(ex, documentId) {
  await ex.run(
    `UPDATE documents SET disponible = CASE WHEN EXISTS (
        SELECT 1 FROM document_copies WHERE document_id = ? AND statut = 'disponible') THEN 1 ELSE 0 END
     WHERE id = ?`,
    [documentId, documentId]
  );
}

/** Passe en retard les prêts échus. Renvoie le nombre de prêts modifiés. */
export async function markOverdueLoans(ex) {
  return ex.run("UPDATE loans SET statut = 'en_retard' WHERE statut = 'en_cours' AND date_retour_prevue < app_now()");
}

/** Vérifie qu'un lecteur a le droit d'emprunter (statut, retards, quota). */
export async function assertCanBorrow(ex, userId) {
  const reader = await ex.one("SELECT id, nom, prenom, statut, role FROM users WHERE id = ?", [userId]);
  if (!reader) throw new CirculationError("Lecteur introuvable.");
  if (reader.statut === "suspendu") throw new CirculationError("Compte suspendu : prêt impossible tant que la situation n'est pas régularisée.");
  if (reader.statut === "en_attente") throw new CirculationError("Compte en attente de validation par la bibliothèque.");

  await markOverdueLoans(ex);
  const c = await ex.one(
    `SELECT COUNT(*) FILTER (WHERE statut IN ('en_cours','en_retard')) AS actifs,
            COUNT(*) FILTER (WHERE statut = 'en_retard') AS retards
     FROM loans WHERE user_id = ?`,
    [userId]
  );
  if (c.retards > 0) throw new CirculationError("Ce lecteur a des documents en retard : ils doivent être rendus avant tout nouveau prêt.");
  const max = Number(await setting("max_emprunts_simultanes", 3, ex));
  if (c.actifs >= max) throw new CirculationError(`Quota atteint : ${max} emprunts simultanés maximum.`);
  return reader;
}

/**
 * Choisit un exemplaire prêtable pour ce lecteur (verrouillé jusqu'à la fin de la transaction).
 * Un exemplaire « réservé » (mis de côté au retour) n'est prêtable qu'au lecteur dont la réservation est disponible.
 */
async function pickCopy(ex, documentId, userId, copyId = null) {
  const hasHold = !!(await ex.val(
    "SELECT id FROM reservations WHERE document_id = ? AND user_id = ? AND statut = 'disponible' LIMIT 1",
    [documentId, userId]
  ));
  const allowed = hasHold ? ["disponible", "reserve"] : ["disponible"];

  let id;
  if (copyId) {
    id = await ex.val(
      "SELECT id FROM document_copies WHERE id = ? AND document_id = ? AND statut = ANY(?) FOR UPDATE",
      [copyId, documentId, allowed]
    );
  } else {
    // Priorité à l'exemplaire mis de côté pour ce lecteur
    id = await ex.val(
      `SELECT id FROM document_copies WHERE document_id = ? AND statut = ANY(?)
       ORDER BY (statut = 'reserve') DESC, numero_exemplaire ASC LIMIT 1 FOR UPDATE`,
      [documentId, allowed]
    );
  }
  if (!id) throw new CirculationError(copyId ? "Cet exemplaire n'est pas disponible." : "Aucun exemplaire disponible pour ce document.");
  return Number(id);
}

/** Enregistre un prêt. À appeler dans une transaction. */
export async function createLoan(ex, req, documentId, userId, copyId = null, days = null) {
  const reader = await assertCanBorrow(ex, userId);
  const doc = await ex.one("SELECT id, titre FROM documents WHERE id = ?", [documentId]);
  if (!doc) throw new CirculationError("Document introuvable.");

  copyId = await pickCopy(ex, documentId, userId, copyId);
  days = days ? Math.max(1, Math.min(120, parseInt(days, 10) || 1)) : Number(await setting("duree_pret_jours", 14, ex));

  const loan = await ex.one(
    `INSERT INTO loans (document_id, copy_id, user_id, date_retour_prevue, statut)
     VALUES (?, ?, ?, app_now() + make_interval(days => ?), 'en_cours')
     RETURNING id, date_retour_prevue`,
    [documentId, copyId, userId, days]
  );

  await ex.run("UPDATE document_copies SET statut = 'emprunte' WHERE id = ?", [copyId]);
  await refreshDocumentAvailability(ex, documentId);

  // La réservation éventuelle de ce lecteur est honorée
  await ex.run(
    "UPDATE reservations SET statut = 'honoree' WHERE document_id = ? AND user_id = ? AND statut IN ('en_attente','disponible')",
    [documentId, userId]
  );

  await ex.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Emprunt confirmé', ?, 'emprunt')", [
    userId,
    `Votre emprunt de « ${doc.titre} » est enregistré. Date limite de retour : ${frDate(loan.date_retour_prevue)}.`,
  ]);

  await logActivity(ex, req, `Prêt de « ${doc.titre} » à ${reader.nom} ${reader.prenom || ""}`.trim(), {
    cibleType: "loan",
    cibleId: loan.id,
    details: { document_id: documentId, user_id: userId, copy_id: copyId, date_retour: loan.date_retour_prevue },
  });

  return { id: loan.id, date_retour_prevue: loan.date_retour_prevue, titre: doc.titre, copy_id: copyId };
}

/** Passe la réservation suivante (s'il y en a une) en « disponible » et prévient le lecteur. */
async function promoteNextReservation(ex, documentId, titre = null) {
  const next = await ex.one(
    "SELECT * FROM reservations WHERE document_id = ? AND statut = 'en_attente' ORDER BY rang_file ASC, date_reservation ASC LIMIT 1",
    [documentId]
  );
  if (!next) return null;
  const hours = Number(await setting("delai_recuperation_reservation_heures", 48, ex));
  const { date_expiration: exp } = await ex.one(
    "UPDATE reservations SET statut = 'disponible', date_expiration = app_now() + make_interval(hours => ?) WHERE id = ? RETURNING date_expiration",
    [hours, next.id]
  );
  await ex.run(
    "UPDATE reservations SET rang_file = GREATEST(1, rang_file - 1) WHERE document_id = ? AND statut = 'en_attente'",
    [documentId]
  );
  const message = titre
    ? `« ${titre} » vous attend à l'accueil de la bibliothèque jusqu'au ${frDate(exp, true)}.`
    : `Le document réservé vous attend à l'accueil jusqu'au ${frDate(exp, true)}.`;
  await ex.run(
    "INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Votre réservation est disponible', ?, 'reservation')",
    [next.user_id, message]
  );
  return next;
}

/**
 * Enregistre le retour d'un prêt. À appeler dans une transaction.
 * Si une réservation attend, l'exemplaire est mis de côté (statut « reserve ») et le lecteur est prévenu.
 */
export async function returnLoan(ex, req, loanId) {
  const loan = await ex.one(
    `SELECT l.*, d.titre,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (app_now() - l.date_retour_prevue)) / 86400))::int AS jours_retard_calc
     FROM loans l JOIN documents d ON d.id = l.document_id WHERE l.id = ? FOR UPDATE OF l`,
    [loanId]
  );
  if (!loan) throw new CirculationError("Prêt introuvable.");
  if (loan.statut === "retourne") return { already: true, titre: loan.titre };

  const joursRetard = loan.jours_retard_calc;
  await ex.run("UPDATE loans SET statut = 'retourne', date_retour_reelle = app_now() WHERE id = ?", [loanId]);

  const next = await promoteNextReservation(ex, loan.document_id, loan.titre);
  if (loan.copy_id) {
    await ex.run("UPDATE document_copies SET statut = ? WHERE id = ?", [next ? "reserve" : "disponible", loan.copy_id]);
  }
  await refreshDocumentAvailability(ex, loan.document_id);

  await ex.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Retour enregistré', ?, 'emprunt')", [
    loan.user_id,
    `Le retour de « ${loan.titre} » a bien été enregistré. Merci !`,
  ]);

  // Lever la suspension automatique si le lecteur n'a plus aucun retard
  const retards = await ex.val("SELECT COUNT(*) FROM loans WHERE user_id = ? AND statut = 'en_retard'", [loan.user_id]);
  if (retards === 0) {
    await ex.run(
      `UPDATE users SET statut = 'actif' WHERE id = ? AND statut = 'suspendu'
       AND EXISTS (SELECT 1 FROM activity_logs WHERE cible_type = 'suspension_auto' AND cible_id = ?)`,
      [loan.user_id, loan.user_id]
    );
  }

  await logActivity(ex, req, `Retour de « ${loan.titre} »` + (joursRetard ? ` (${joursRetard} j de retard)` : ""), {
    cibleType: "loan",
    cibleId: loanId,
    details: { user_id: loan.user_id, jours_retard: joursRetard, reservation_suivante: next?.id ?? null },
  });

  return { already: false, titre: loan.titre, jours_retard: joursRetard, reserve_pour: next?.user_id ?? null };
}

/** Expire les réservations « disponibles » non retirées à temps et passe l'exemplaire au suivant. */
export async function expireReservations(ex) {
  const expired = await ex.all("SELECT id, document_id FROM reservations WHERE statut = 'disponible' AND date_expiration < app_now()");
  for (const r of expired) {
    await ex.run("UPDATE reservations SET statut = 'annulee' WHERE id = ?", [r.id]);
    const next = await promoteNextReservation(ex, r.document_id);
    if (!next) {
      // Plus personne n'attend : l'exemplaire mis de côté redevient disponible
      await ex.run(
        `UPDATE document_copies SET statut = 'disponible'
         WHERE id = (SELECT id FROM document_copies WHERE document_id = ? AND statut = 'reserve' LIMIT 1)`,
        [r.document_id]
      );
      await refreshDocumentAvailability(ex, r.document_id);
    }
  }
  return expired.length;
}

/**
 * Traitement quotidien : retards, suspensions automatiques, réservations expirées.
 * Utilisé par le cron intégré, par « npm run cron » et par le bouton des Paramètres.
 */
export async function runDailyProcessing(ex, req = null) {
  const marked = await markOverdueLoans(ex);
  const days = Number(await setting("jours_retard_suspension", 10, ex));
  const users = await ex.all(
    `SELECT DISTINCT u.id, u.nom, u.prenom FROM users u JOIN loans l ON l.user_id = u.id
     WHERE l.statut = 'en_retard' AND (app_now()::date - l.date_retour_prevue::date) > ?
       AND u.statut = 'actif' AND u.role IN ('adherent','visiteur')`,
    [days]
  );
  for (const u of users) {
    await ex.run("UPDATE users SET statut = 'suspendu' WHERE id = ?", [u.id]);
    await ex.run("INSERT INTO notifications (user_id, titre, message, type) VALUES (?, 'Compte suspendu', ?, 'retard')", [
      u.id,
      `Votre compte est suspendu : un document a plus de ${days} jours de retard. Il sera réactivé automatiquement dès le retour de vos documents en retard.`,
    ]);
    // cible_type 'suspension_auto' : permet la levée automatique au retour (voir returnLoan)
    await logActivity(ex, req, `Suspension automatique de ${u.nom} ${u.prenom || ""} (retard > ${days} j)`, {
      cibleType: "suspension_auto",
      cibleId: u.id,
      user: { id: null, nom: "Système", role: "systeme" },
    });
  }
  await expireReservations(ex);
  return {
    marked,
    suspended: users.length,
    message: `Traitement terminé : ${marked} prêt(s) passé(s) en retard, ${users.length} compte(s) suspendu(s).`,
  };
}
