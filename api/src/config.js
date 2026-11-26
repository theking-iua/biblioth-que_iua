// Configuration centrale de l'API PMB IUA (lue depuis les variables d'environnement / fichier .env).
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;

const list = (v, def) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : def);
const bool = (v, def = false) => (v === undefined || v === "" ? def : ["1", "true", "yes", "oui"].includes(String(v).toLowerCase()));

export const config = {
  port: Number(env.PORT || 4000),
  nodeEnv: env.NODE_ENV || "development",

  // Chaîne de connexion Neon : Dashboard Neon → Connection string (avec ?sslmode=require)
  databaseUrl: env.DATABASE_URL || "",
  // Fuseau de la bibliothèque : toutes les dates sont stockées et affichées à cette heure
  timezone: env.APP_TIMEZONE || "Africa/Abidjan",

  jwtSecret: env.JWT_SECRET || "",
  jwtTtlSeconds: Number(env.JWT_TTL_SECONDS || 60 * 60 * 12),

  // Origines autorisées à appeler l'API (appli admin + appli mobile)
  corsOrigins: list(env.CORS_ORIGINS, [
    "http://localhost:5173", // appli admin (dev)
    "http://localhost:5174", // appli mobile (dev)
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ]),

  // URL publique de l'API (pour construire les liens de photos)
  publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 4000}/api`).replace(/\/$/, ""),

  // Dossier des fichiers déposés (photos, PDF de mémoires)
  uploadDir: path.resolve(root, env.UPLOAD_DIR || "uploads"),

  // Derrière un proxy (Render, Railway, Nginx…) : nécessaire pour lire la vraie IP du client
  trustProxy: bool(env.TRUST_PROXY, true),

  loginMaxAttempts: Number(env.LOGIN_MAX_ATTEMPTS || 5),

  // Traitement quotidien intégré (retards, suspensions, réservations expirées)
  cronEnabled: bool(env.CRON_ENABLED, false),
  cronHour: Number(env.CRON_HOUR || 2),

  // Connexion Microsoft 365 (Entra ID)
  sso: {
    enabled: bool(env.SSO_ENABLED, false),
    clientId: env.SSO_CLIENT_ID || "",
    tenantId: env.SSO_TENANT_ID || "common",
    allowedDomain: (env.SSO_ALLOWED_DOMAIN || "iua.ci").toLowerCase(),
  },
};

export function assertConfig() {
  const problems = [];
  if (!config.databaseUrl) problems.push("DATABASE_URL manquant (chaîne de connexion Neon).");
  if (!config.jwtSecret || config.jwtSecret.length < 32) problems.push("JWT_SECRET manquant ou trop court (32 caractères minimum).");
  if (problems.length) {
    console.error("[PMB IUA] Configuration incomplète :\n - " + problems.join("\n - ") + "\nVoir api/.env.example.");
    process.exit(1);
  }
}
