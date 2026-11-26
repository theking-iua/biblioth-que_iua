// Lecteurs (members) et comptes du personnel (admin-users).
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "../db.js";
import { ah, fail } from "../errors.js";
import { requireAuth, requireStaff, requireAdmin, isStaff, READER_ROLES } from "../auth.js";
import { logActivity } from "../logger.js";

const r = Router();
const STATUTS = ["actif", "suspendu", "en_attente"];
const ALL_ROLES = ["admin", "bibliothecaire", "adherent", "visiteur"];
const isEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const str = (v, def = "") => (v === undefined || v === null ? def : String(v)).trim();

// ================================================================ /api/members (lecteurs)

r.get("/members", ah(async (req, res) => {
  requireStaff(req);
  const search = str(req.query.q);
  let sql = `
    SELECT u.id, u.nom, u.prenom, u.email, u.matricule, u.filiere, u.telephone, u.role, u.statut, u.date_creation, u.photo,
           COUNT(l.id) FILTER (WHERE l.statut = 'en_cours')  AS loans,
           COUNT(l.id) FILTER (WHERE l.statut = 'en_retard') AS late_loans,
           (SELECT COUNT(*) FROM reservations r WHERE r.user_id = u.id AND r.statut IN ('en_attente','disponible')) AS reservations
    FROM users u
    LEFT JOIN loans l ON l.user_id = u.id AND l.statut IN ('en_cours','en_retard')
    WHERE u.role IN ('adherent','visiteur')`;
  const params = [];
  if (search) {
    sql += ` AND (f_unaccent(u.nom) LIKE f_unaccent(?) OR f_unaccent(coalesce(u.prenom,'')) LIKE f_unaccent(?)
             OR lower(u.email) LIKE lower(?) OR coalesce(u.matricule,'') ILIKE ? OR f_unaccent(coalesce(u.filiere,'')) LIKE f_unaccent(?))`;
    params.push(...Array(5).fill(`%${search}%`));
  }
  sql += " GROUP BY u.id ORDER BY u.date_creation DESC, u.id DESC";
  res.json(await db.all(sql, params));
}));

// Inscription publique (compte visiteur) ou création par le personnel
r.post("/members", ah(async (req, res) => {
  const d = req.body || {};
  const byStaff = isStaff(req.user);
  const nom = str(d.nom), prenom = str(d.prenom), email = str(d.email).toLowerCase();
  const password = String(d.mot_de_passe ?? "");
  let matricule = str(d.matricule);
  const filiere = str(d.filiere), telephone = str(d.telephone);

  if (!nom || !email || !password) fail("Le nom, l'adresse email et le mot de passe sont obligatoires.");
  if (!isEmail(email)) fail("Adresse email invalide.");
  if (password.length < 6) fail("Le mot de passe doit contenir au moins 6 caractères.");

  // Inscription publique : toujours un compte visiteur actif. Le personnel peut choisir rôle et statut.
  const role = byStaff && READER_ROLES.includes(d.role) ? d.role : "visiteur";
  const statut = byStaff && STATUTS.includes(d.statut) ? d.statut : "actif";

  if (!matricule) matricule = `IUA-${new Date().getFullYear()}-${crypto.randomInt(10000, 100000)}`;
  const dup = await db.val("SELECT COUNT(*) FROM users WHERE lower(email) = ? OR matricule = ?", [email, matricule]);
  if (dup > 0) fail("Cette adresse email ou ce matricule est déjà utilisé.", 409);

  const newId = await db.insert(
    `INSERT INTO users (nom, prenom, email, mot_de_passe, matricule, filiere, telephone, role, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, prenom, email, await bcrypt.hash(password, 10), matricule, filiere, telephone, role, statut]
  );
  await logActivity(db, req, `${byStaff ? "Création du lecteur" : "Inscription en ligne"} : ${nom} ${prenom} (${matricule})`, {
    cibleType: "user", cibleId: newId, details: { email, role },
    user: byStaff ? null : { id: newId, nom, role },
  });
  res.json({ success: true, id: newId, matricule, message: "Compte créé avec succès" });
}));

// Personnel : fiche complète ou statut seul. Lecteur : son propre profil (champs limités).
r.put("/members", ah(async (req, res) => {
  const me = requireAuth(req);
  const d = req.body || {};
  const id = Number(d.id) || 0;
  if (!id) fail("Identifiant de l'utilisateur requis");
  const self = Number(me.id) === id;
  const staff = isStaff(me);
  if (!self && !staff) fail("Vous ne pouvez modifier que votre propre profil.", 403);

  const target = await db.one("SELECT * FROM users WHERE id = ?", [id]);
  if (!target) fail("Utilisateur introuvable", 404);
  if (!self && !READER_ROLES.includes(target.role)) fail("Les comptes du personnel se gèrent depuis « Utilisateurs ».", 403);

  // Changement de statut seul (bloquer / débloquer)
  if (staff && d.statut !== undefined && !d.nom) {
    if (!STATUTS.includes(d.statut)) fail("Statut invalide");
    await db.run("UPDATE users SET statut = ? WHERE id = ?", [d.statut, id]);
    await logActivity(db, req, `Statut du lecteur ${target.nom} → ${d.statut}`, { cibleType: "user", cibleId: id });
    return res.json({ success: true, message: "Statut mis à jour." });
  }

  const nom = str(d.nom, target.nom);
  const prenom = str(d.prenom, target.prenom ?? "");
  const email = str(d.email, target.email).toLowerCase();
  const telephone = str(d.telephone, target.telephone ?? "");
  const filiere = str(d.filiere, target.filiere ?? "");
  if (!nom || !isEmail(email)) fail("Nom et email valides requis");

  // Le matricule, le rôle et le statut ne sont modifiables que par le personnel
  const matricule = staff ? str(d.matricule, target.matricule ?? "") : target.matricule;
  const statut = staff && STATUTS.includes(d.statut) ? d.statut : target.statut;
  const role = staff && !self && READER_ROLES.includes(d.role) ? d.role : target.role;

  const dup = await db.val(
    "SELECT COUNT(*) FROM users WHERE (lower(email) = ? OR (matricule = ? AND matricule <> '')) AND id <> ?",
    [email, matricule ?? "", id]
  );
  if (dup > 0) fail("Cette adresse email ou ce matricule est déjà utilisé.", 409);

  const sets = ["nom = ?", "prenom = ?", "email = ?", "matricule = ?", "filiere = ?", "telephone = ?", "statut = ?", "role = ?"];
  const params = [nom, prenom, email, matricule, filiere, telephone, statut, role];

  const newPass = String(d.mot_de_passe ?? "");
  if (newPass) {
    if (newPass.length < 6) fail("Le mot de passe doit contenir au moins 6 caractères.");
    // Un lecteur doit confirmer son mot de passe actuel
    if (self && !(await bcrypt.compare(String(d.ancien_mot_de_passe ?? ""), target.mot_de_passe).catch(() => false))) {
      fail("Mot de passe actuel incorrect.", 403);
    }
    sets.push("mot_de_passe = ?");
    params.push(await bcrypt.hash(newPass, 10));
  }
  params.push(id);
  await db.run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);

  await logActivity(db, req, (self ? "Mise à jour de son profil" : `Mise à jour du lecteur ${nom} ${prenom}`) + (newPass ? " (mot de passe changé)" : ""), {
    cibleType: "user", cibleId: id,
  });
  res.json({ success: true });
}));

r.delete("/members", ah(async (req, res) => {
  requireStaff(req);
  const id = Number(req.query.id) || 0;
  if (!id) fail("Identifiant manquant");
  const u = await db.one("SELECT nom, prenom FROM users WHERE id = ? AND role IN ('adherent','visiteur')", [id]);
  if (!u) fail("Lecteur introuvable", 404);
  const busy = await db.val("SELECT COUNT(*) FROM loans WHERE user_id = ? AND statut IN ('en_cours','en_retard')", [id]);
  if (busy > 0) fail("Ce lecteur a encore des documents en prêt : enregistrez leur retour avant de supprimer le compte.", 409);
  await db.run("DELETE FROM users WHERE id = ?", [id]);
  await logActivity(db, req, `Suppression du lecteur ${u.nom} ${u.prenom ?? ""}`.trim(), { cibleType: "user", cibleId: id });
  res.json({ success: true });
}));

// ================================================================ /api/admin-users (administrateurs uniquement)

r.get("/admin-users", ah(async (req, res) => {
  requireAdmin(req);
  res.json(await db.all(
    `SELECT id, nom, prenom, email, role, statut, date_creation FROM users
     ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'bibliothecaire' THEN 2 WHEN 'adherent' THEN 3 ELSE 4 END, date_creation DESC`
  ));
}));

r.post("/admin-users", ah(async (req, res) => {
  requireAdmin(req);
  const d = req.body || {};
  const nom = str(d.nom), email = str(d.email).toLowerCase(), password = String(d.mot_de_passe ?? "");
  const role = ALL_ROLES.includes(d.role) ? d.role : "bibliothecaire";
  const statut = STATUTS.includes(d.statut) ? d.statut : "actif";
  if (!nom || !isEmail(email) || password.length < 8) fail("Nom, email valide et mot de passe (8 caractères minimum) obligatoires");
  const newId = await db.insert(
    `INSERT INTO users (nom, prenom, email, mot_de_passe, role, matricule, telephone, filiere, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, str(d.prenom), email, await bcrypt.hash(password, 10), role, str(d.matricule) || null, str(d.telephone), str(d.filiere), statut]
  );
  await logActivity(db, req, `Création du compte ${nom} (${role})`, { cibleType: "user", cibleId: newId, details: { email, role } });
  res.json({ success: true, id: newId });
}));

r.put("/admin-users", ah(async (req, res) => {
  const me = requireAdmin(req);
  const d = req.body || {};
  const id = Number(d.id) || 0;
  const nom = str(d.nom), email = str(d.email).toLowerCase(), role = d.role;
  if (!id || !nom || !isEmail(email) || !ALL_ROLES.includes(role)) fail("Champs manquants ou invalides");
  if (id === Number(me.id) && role !== "admin") fail("Vous ne pouvez pas retirer vos propres droits d'administrateur.");

  const password = String(d.mot_de_passe ?? "");
  if (password) {
    if (password.length < 8) fail("Le mot de passe doit contenir au moins 8 caractères.");
    await db.run("UPDATE users SET nom = ?, email = ?, role = ?, mot_de_passe = ? WHERE id = ?", [nom, email, role, await bcrypt.hash(password, 10), id]);
  } else {
    await db.run("UPDATE users SET nom = ?, email = ?, role = ? WHERE id = ?", [nom, email, role, id]);
  }
  await logActivity(db, req, `Modification du compte ${nom} (${role})`, { cibleType: "user", cibleId: id });
  res.json({ success: true });
}));

r.delete("/admin-users", ah(async (req, res) => {
  const me = requireAdmin(req);
  const id = Number(req.query.id) || 0;
  if (!id) fail("Identifiant manquant");
  if (id === Number(me.id)) fail("Vous ne pouvez pas supprimer votre propre compte.");
  const u = await db.one("SELECT nom, role FROM users WHERE id = ?", [id]);
  if (!u) fail("Utilisateur introuvable", 404);
  if (u.role === "admin" && (await db.val("SELECT COUNT(*) FROM users WHERE role = 'admin'")) <= 1) {
    fail("Impossible de supprimer le dernier administrateur.");
  }
  if ((await db.val("SELECT COUNT(*) FROM loans WHERE user_id = ? AND statut IN ('en_cours','en_retard')", [id])) > 0) {
    fail("Ce compte a encore des documents en prêt.", 409);
  }
  await db.run("DELETE FROM users WHERE id = ?", [id]);
  await logActivity(db, req, `Suppression du compte ${u.nom} (${u.role})`, { cibleType: "user", cibleId: id });
  res.json({ success: true });
}));

export default r;
