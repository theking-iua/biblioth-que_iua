// Connexion par email/matricule + mot de passe, et connexion Microsoft 365 (Entra ID).
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "../db.js";
import { config } from "../config.js";
import { ah, fail } from "../errors.js";
import { createToken } from "../auth.js";
import { logActivity } from "../logger.js";

const r = Router();

const publicUser = (u) => ({
  id: Number(u.id),
  nom: u.nom,
  prenom: u.prenom ?? "",
  email: u.email,
  matricule: u.matricule ?? "",
  filiere: u.filiere ?? "",
  telephone: u.telephone ?? "",
  role: u.role,
  statut: u.statut,
  photo: u.photo ?? null,
});

// POST /api/login
r.post("/login", ah(async (req, res) => {
  const identifiant = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!identifiant || !password) fail("Email et mot de passe requis");
  const ip = req.ip || "inconnue";

  // Anti brute-force : trop d'échecs récents pour cette IP + cet identifiant
  const attempts = await db.val(
    "SELECT COUNT(*) FROM login_attempts WHERE ip_address = ? AND email = ? AND date > app_now() - interval '15 minutes'",
    [ip, identifiant]
  );
  if (attempts >= config.loginMaxAttempts) fail("Trop de tentatives échouées. Réessayez dans 15 minutes.", 429);

  const user = await db.one(
    "SELECT * FROM users WHERE lower(email) = lower(?) OR (matricule IS NOT NULL AND matricule <> '' AND matricule = ?) LIMIT 1",
    [identifiant, identifiant]
  );

  if (!user || !(await bcrypt.compare(password, user.mot_de_passe).catch(() => false))) {
    await db.run("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)", [ip, identifiant]);
    await logActivity(db, req, "Échec de connexion", { cibleType: "auth", details: `Identifiant : ${identifiant}` });
    fail("Identifiants invalides", 401);
  }
  if (user.statut === "suspendu") {
    fail("Votre compte est suspendu. Présentez-vous à l'accueil de la bibliothèque pour régulariser votre situation.", 403);
  }
  if (user.statut === "en_attente") fail("Votre compte est en attente de validation par la bibliothèque.", 403);

  await db.run("DELETE FROM login_attempts WHERE ip_address = ? AND email = ?", [ip, identifiant]);
  await logActivity(db, req, "Connexion au portail", { cibleType: "auth", cibleId: user.id, user });

  res.json({ token: createToken(user), user: publicUser(user) });
}));

// ---------------------------------------------------------------- Microsoft 365
let jwksCache = { at: 0, keys: null };
async function msSigningKeys() {
  if (jwksCache.keys && Date.now() - jwksCache.at < 86_400_000) return jwksCache.keys;
  const tenant = encodeURIComponent(config.sso.tenantId);
  const resp = await fetch(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`, { signal: AbortSignal.timeout(10_000) });
  const body = await resp.json().catch(() => null);
  if (!body?.keys?.length) return null;
  jwksCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}

const b64urlJson = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

// GET /api/sso : le frontend sait s'il doit afficher le bouton Microsoft
r.get("/sso", (_req, res) => {
  const on = config.sso.enabled && !!config.sso.clientId;
  res.json({ enabled: on, client_id: on ? config.sso.clientId : null, tenant_id: on ? config.sso.tenantId : null });
});

// POST /api/sso : vérifie l'id_token Microsoft (signature, audience, expiration, émetteur, nonce, domaine)
r.post("/sso", ah(async (req, res) => {
  if (!config.sso.enabled || !config.sso.clientId) fail("La connexion Microsoft 365 n'est pas activée sur ce serveur.", 503);
  const idToken = String(req.body?.id_token ?? "");
  const nonce = String(req.body?.nonce ?? "");
  const parts = idToken.split(".");
  if (parts.length !== 3) fail("Jeton Microsoft manquant ou invalide.", 401);

  let header, claims;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
  } catch {
    fail("Jeton Microsoft invalide.", 401);
  }
  if (header.alg !== "RS256" || !header.kid || !claims) fail("Jeton Microsoft invalide.", 401);

  const keys = await msSigningKeys();
  const jwk = keys?.find((k) => k.kid === header.kid);
  if (!jwk) fail("Signature du jeton Microsoft invalide.", 401);
  const ok = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: "jwk" }),
    Buffer.from(parts[2], "base64url")
  );
  if (!ok) fail("Signature du jeton Microsoft invalide.", 401);

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== config.sso.clientId) fail("Jeton émis pour une autre application.", 401);
  if ((claims.exp ?? 0) < now - 60 || (claims.nbf ?? 0) > now + 60) fail("Jeton Microsoft expiré.", 401);
  if (!/^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]+\/v2\.0$/.test(claims.iss ?? "")) fail("Émetteur du jeton non reconnu.", 401);
  const expected = Buffer.from(String(claims.nonce ?? ""));
  if (!nonce || expected.length !== Buffer.byteLength(nonce) || !crypto.timingSafeEqual(expected, Buffer.from(nonce))) {
    fail("Jeton Microsoft rejoué ou nonce invalide.", 401);
  }

  const email = String(claims.preferred_username ?? claims.email ?? claims.upn ?? "").trim().toLowerCase();
  const domain = config.sso.allowedDomain;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !email.endsWith(`@${domain}`)) fail(`Seules les adresses @${domain} sont autorisées.`, 403);

  let user = await db.one("SELECT * FROM users WHERE lower(email) = ?", [email]);
  if (!user) {
    // Création automatique d'un compte lecteur pour les membres de l'IUA
    const [first, ...rest] = String(claims.name ?? "").trim().split(/\s+/);
    const nom = first || email.split("@")[0];
    const hash = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
    await db.run("INSERT INTO users (nom, prenom, email, mot_de_passe, role, statut) VALUES (?, ?, ?, ?, 'adherent', 'actif')", [
      nom, rest.join(" "), email, hash,
    ]);
    user = await db.one("SELECT * FROM users WHERE lower(email) = ?", [email]);
    await logActivity(db, req, `Création de compte via Microsoft 365 : ${email}`, { cibleType: "user", cibleId: user.id, user });
  }
  if (user.statut === "suspendu") fail("Votre compte est suspendu. Contactez la bibliothèque.", 403);

  await logActivity(db, req, "Connexion Microsoft 365", { cibleType: "auth", cibleId: user.id, user });
  res.json({ token: createToken(user), user: publicUser(user) });
}));

// GET /api/me : profil à jour de l'utilisateur connecté (utile au démarrage des applis)
r.get("/me", ah(async (req, res) => {
  if (!req.user) fail("Session expirée ou non connectée. Veuillez vous reconnecter.", 401);
  const u = await db.one("SELECT * FROM users WHERE id = ?", [req.user.id]);
  res.json(publicUser(u));
}));

export default r;
