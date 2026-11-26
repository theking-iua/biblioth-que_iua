// server.js : point d'entrée de l'API PMB IUA (Express + PostgreSQL/Neon).
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { config, assertConfig } from "./config.js";
import { pool, tx } from "./db.js";
import { loadUser } from "./auth.js";
import { errorHandler } from "./errors.js";
import { runDailyProcessing } from "./circulation.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import catalogueRoutes from "./routes/catalogue.js";
import circulationRoutes from "./routes/circulation.js";
import adminRoutes from "./routes/admin.js";
import fileRoutes from "./routes/files.js";

assertConfig();

export const app = express();
app.set("trust proxy", config.trustProxy);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));
app.use(express.json({ limit: "2mb" }));

const api = express.Router();
api.use(loadUser);

api.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "ok" });
  } catch {
    res.status(503).json({ ok: false, database: "indisponible" });
  }
});

api.use(authRoutes, userRoutes, catalogueRoutes, circulationRoutes, adminRoutes, fileRoutes);

// Fichiers déposés : jamais exécutés, uniquement images et PDF
api.use("/uploads", (req, res, next) => {
  if (!/^\/(photos|memoires)\/[A-Za-z0-9_.-]+\.(jpg|png|webp|pdf)$/i.test(req.path)) return res.status(404).json({ error: "Fichier introuvable" });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  next();
}, express.static(path.resolve(config.uploadDir), { index: false, dotfiles: "deny", fallthrough: false }));

api.use((_req, res) => res.status(404).json({ error: "Route introuvable" }));
app.use("/api", api);
app.get("/", (_req, res) => res.json({ name: "PMB IUA API", version: "2.0.0", docs: "/api/health" }));
app.use(errorHandler);

// ---------------------------------------------------------------- Traitement quotidien intégré (facultatif)
function scheduleDailyJob() {
  let lastRun = null;
  setInterval(async () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: config.timezone }));
    const today = now.toDateString();
    if (now.getHours() === config.cronHour && lastRun !== today) {
      lastRun = today;
      try {
        const out = await tx((t) => runDailyProcessing(t, null));
        console.log("[PMB IUA] " + out.message);
      } catch (e) {
        console.error("[PMB IUA] Échec du traitement quotidien :", e.message);
      }
    }
  }, 60_000).unref();
}

if (process.env.NODE_ENV !== "test") {
  app.listen(config.port, () => {
    console.log(`[PMB IUA] API démarrée sur http://localhost:${config.port}/api`);
    if (config.cronEnabled) {
      scheduleDailyJob();
      console.log(`[PMB IUA] Traitement quotidien activé (chaque jour à ${config.cronHour}h, ${config.timezone}).`);
    }
  });
}
