// auth.js : jetons JWT (HS256) et contrôle d'accès par rôle.
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError } from "./errors.js";

export const READER_ROLES = ["adherent", "visiteur"];
export const STAFF_ROLES = ["admin", "bibliothecaire"];

export function createToken(user) {
  return jwt.sign({ user_id: Number(user.id), role: user.role }, config.jwtSecret, {
    algorithm: "HS256",
    expiresIn: config.jwtTtlSeconds,
  });
}

export const isStaff = (user) => !!user && STAFF_ROLES.includes(user.role);

/** Middleware global : lit le jeton (s'il y en a un) et charge l'utilisateur à jour depuis la base. */
export async function loadUser(req, _res, next) {
  req.user = null;
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
  if (!m) return next();
  try {
    const payload = jwt.verify(m[1], config.jwtSecret, { algorithms: ["HS256"] });
    if (payload?.user_id) {
      req.user = await db.one("SELECT id, nom, prenom, email, role, statut FROM users WHERE id = ?", [payload.user_id]);
    }
  } catch {
    req.user = null; // jeton expiré ou falsifié : traité comme non connecté
  }
  next();
}

export function requireAuth(req) {
  if (!req.user) throw new HttpError("Session expirée ou non connectée. Veuillez vous reconnecter.", 401);
  return req.user;
}

export function requireStaff(req) {
  const u = requireAuth(req);
  if (!isStaff(u)) throw new HttpError("Accès réservé au personnel de la bibliothèque.", 403);
  return u;
}

export function requireAdmin(req) {
  const u = requireAuth(req);
  if (u.role !== "admin") throw new HttpError("Accès réservé aux administrateurs.", 403);
  return u;
}

/** Lecteur : impose son propre identifiant. Personnel : accepte l'identifiant demandé (ou aucun = tous). */
export function resolveUserId(user, requested) {
  if (isStaff(user)) return requested ? Number(requested) || null : null;
  return Number(user.id);
}
