// logger.js : journalisation des actions (table activity_logs). Ne fait jamais échouer la requête.
import { db } from "./db.js";

/**
 * @param {object} ex   exécuteur (db ou transaction)
 * @param {object} req  requête Express (utilisateur connecté + IP) — peut être null (scripts)
 * @param {string} action
 * @param {object} [opts] { cibleType, cibleId, details, user: {id, nom, role} }
 */
export async function logActivity(ex, req, action, { cibleType = null, cibleId = null, details = null, user = null } = {}) {
  try {
    let userId = user?.id ?? req?.user?.id ?? null;
    let userName = user?.nom ?? req?.user?.nom ?? null;
    let userRole = user?.role ?? req?.user?.role ?? null;

    if (userId && !userName) {
      const u = await (ex || db).one("SELECT nom, role FROM users WHERE id = ?", [userId]);
      if (u) ({ nom: userName, role: userRole } = u);
    }
    if (details !== null && typeof details === "object") details = JSON.stringify(details);

    const target = ex || db;
    const inTx = target !== db;
    // Dans une transaction, un point de sauvegarde évite qu'un échec du journal annule l'opération
    if (inTx) await target.run("SAVEPOINT log_activity");
    try {
      await target.run(
        `INSERT INTO activity_logs (user_id, user_name, user_role, action, cible_type, cible_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, userName, userRole, String(action).slice(0, 255), cibleType, cibleId, details, req?.ip ?? "cli"]
      );
      if (inTx) await target.run("RELEASE SAVEPOINT log_activity");
    } catch (e) {
      if (inTx) await target.run("ROLLBACK TO SAVEPOINT log_activity");
      throw e;
    }
    return true;
  } catch (e) {
    console.error("[PMB IUA] Erreur logActivity :", e.message);
    return false;
  }
}
