// Fichiers déposés : photo de profil, PDF de mémoire, import CSV des lecteurs.
import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db, tx } from "../db.js";
import { config } from "../config.js";
import { ah, fail } from "../errors.js";
import { requireAuth, requireStaff, isStaff } from "../auth.js";
import { logActivity } from "../logger.js";
import { importReadersCsv } from "../import-readers.js";

const r = Router();
const mem = (maxMb) => multer({ storage: multer.memoryStorage(), defParamCharset: "utf8", limits: { fileSize: maxMb * 1024 * 1024, files: 1 } });

/** Type réel d'une image d'après son contenu (jamais d'après l'extension fournie). */
function imageType(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// POST /api/photo-upload : le lecteur pour lui-même, ou le personnel pour un lecteur
r.post("/photo-upload", mem(3).single("photo"), ah(async (req, res) => {
  const me = requireAuth(req);
  const userId = isStaff(me) && req.body?.user_id ? Number(req.body.user_id) : Number(me.id);
  if (!req.file) fail("Aucune photo reçue ou erreur d'envoi");
  const ext = imageType(req.file.buffer);
  if (!ext) fail("Format non autorisé : JPEG, PNG ou WebP uniquement.");

  const dir = path.join(config.uploadDir, "photos");
  await fs.mkdir(dir, { recursive: true });
  const filename = `user_${userId}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  // Supprimer l'ancienne photo (uniquement si elle est bien dans uploads/photos)
  const old = String((await db.val("SELECT photo FROM users WHERE id = ?", [userId])) || "");
  if (/^uploads\/photos\/[A-Za-z0-9_.-]+$/.test(old)) await fs.unlink(path.join(config.uploadDir, "photos", path.basename(old))).catch(() => {});

  const photo = `uploads/photos/${filename}`;
  await db.run("UPDATE users SET photo = ? WHERE id = ?", [photo, userId]);
  await logActivity(db, req, "Mise à jour de la photo de profil", { cibleType: "user", cibleId: userId });
  res.json({ success: true, photo, photo_url: `${config.publicBaseUrl}/${photo}` });
}));

// POST /api/upload-memoire : PDF d'un mémoire / d'une thèse (personnel)
r.post("/upload-memoire", mem(40).single("fichier"), ah(async (req, res) => {
  requireStaff(req);
  if (!req.file) fail("Aucun fichier reçu ou erreur d'envoi");
  if (req.file.buffer.toString("ascii", 0, 5) !== "%PDF-") fail("Seuls les fichiers PDF sont acceptés.");

  const dir = path.join(config.uploadDir, "memoires");
  await fs.mkdir(dir, { recursive: true });
  const base = path.parse(req.file.originalname || "memoire").name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const filename = `${(base || "memoire").slice(0, 60)}_${crypto.randomBytes(4).toString("hex")}.pdf`;
  await fs.writeFile(path.join(dir, filename), req.file.buffer);

  await logActivity(db, req, `Dépôt du fichier de mémoire ${filename}`, { cibleType: "digital_resource" });
  res.json({ success: true, fichier_path: `/uploads/memoires/${filename}`, url: `${config.publicBaseUrl}/uploads/memoires/${filename}` });
}));

// POST /api/import-lecteurs : CSV « nom;prenom;matricule;filiere;email;telephone » (personnel)
r.post("/import-lecteurs", mem(5).single("fichier"), ah(async (req, res) => {
  requireStaff(req);
  if (!req.file) fail("Aucun fichier CSV reçu");
  const out = await tx((t) => importReadersCsv(t, req, req.file.buffer));
  res.json({ success: true, ...out });
}));

export default r;
