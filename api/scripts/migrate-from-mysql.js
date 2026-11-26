// Transfert des données de l'ancienne base MySQL (XAMPP, base iua_pmp) vers Neon PostgreSQL.
//
//   1. Dans api/.env : DATABASE_URL (Neon) et MYSQL_URL, par ex. mysql://root:@127.0.0.1:3306/iua_pmp
//   2. npm install mysql2     (une seule fois)
//   3. npm run migrate:mysql
//
// La base Neon doit être vide (lancez ce script AVANT npm run db:init, ou ajoutez --force).
// Les identifiants, mots de passe (bcrypt), prêts, historiques et photos référencées sont conservés.
// Pensez à copier aussi le dossier backend/uploads/ de l'ancien serveur dans api/uploads/.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";
import { config } from "../src/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MYSQL_URL = process.env.MYSQL_URL || "mysql://root:@127.0.0.1:3306/iua_pmp";

// Ordre imposé par les clés étrangères
const TABLES = [
  "users", "categories", "authors", "publishers", "locations", "documents", "document_copies",
  "loans", "borrow_requests", "reservations", "digital_resources", "favorites", "notifications",
  "settings", "activity_logs",
];

let mysql;
try {
  mysql = await import("mysql2/promise");
} catch {
  console.error("Le module mysql2 est nécessaire : npm install mysql2");
  process.exit(1);
}

const src = await mysql.createConnection({ uri: MYSQL_URL, dateStrings: true, charset: "utf8mb4" });
const pg = await pool.connect();

try {
  const existing = await pg.query("SELECT to_regclass('public.users') AS t");
  if (existing.rows[0].t) {
    const n = (await pg.query("SELECT COUNT(*)::int AS n FROM users")).rows[0].n;
    if (n > 0 && !process.argv.includes("--force")) {
      throw new Error(`La base Neon contient déjà ${n} utilisateur(s). Utilisez une base vide, ou relancez avec --force (les doublons seront ignorés).`);
    }
  }

  const schema = (await fs.readFile(path.join(here, "..", "db", "schema.sql"), "utf8")).replaceAll("__APP_TIMEZONE__", config.timezone);
  await pg.query(schema);
  console.log("✔ Schéma PostgreSQL créé");

  const [srcTablesRows] = await src.query("SHOW TABLES");
  const srcTables = new Set(srcTablesRows.map((r) => Object.values(r)[0]));
  const copyIds = new Set();
  const userIds = new Set();

  await pg.query("BEGIN");
  for (const table of TABLES) {
    if (!srcTables.has(table)) {
      console.log(`- ${table} : absente de MySQL, ignorée`);
      continue;
    }
    const pgCols = (await pg.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table]
    )).rows.map((r) => r.column_name);
    const [rows] = await src.query(`SELECT * FROM \`${table}\``);
    if (!rows.length) { console.log(`- ${table} : vide`); continue; }
    const cols = Object.keys(rows[0]).filter((c) => pgCols.includes(c));

    const clean = rows.map((row) => {
      const out = {};
      for (const c of cols) {
        let v = row[c];
        if (typeof v === "string" && v.startsWith("0000-00-00")) v = null;
        if (Buffer.isBuffer(v)) v = v.toString("utf8");
        out[c] = v;
      }
      // Références orphelines tolérées par MySQL mais pas par les clés étrangères PostgreSQL
      if (table === "loans" && out.copy_id && !copyIds.has(Number(out.copy_id))) out.copy_id = null;
      if (table === "activity_logs" && out.user_id && !userIds.has(Number(out.user_id))) out.user_id = null;
      if (table === "users" && out.email) out.email = String(out.email).trim().toLowerCase();
      return out;
    });
    if (table === "document_copies") clean.forEach((r) => copyIds.add(Number(r.id)));
    if (table === "users") clean.forEach((r) => userIds.add(Number(r.id)));

    let inserted = 0;
    for (let i = 0; i < clean.length; i += 300) {
      const batch = clean.slice(i, i + 300);
      const params = [];
      const values = batch.map((r) => "(" + cols.map((c) => { params.push(r[c]); return "$" + params.length; }).join(", ") + ")");
      const res = await pg.query(
        `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${values.join(", ")} ON CONFLICT DO NOTHING`,
        params
      );
      inserted += res.rowCount;
    }
    if (pgCols.includes("id")) {
      await pg.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`);
    }
    console.log(`✔ ${table} : ${inserted}/${rows.length} ligne(s)`);
  }
  await pg.query("COMMIT");

  // Compléter ce qui manquerait (paramètres récents, catégories…) sans écraser les données importées
  await pg.query(await fs.readFile(path.join(here, "..", "db", "seed.sql"), "utf8"));
  console.log("✔ Données de référence complétées\nMigration terminée. Copiez backend/uploads/ vers api/uploads/ pour conserver photos et PDF.");
} catch (e) {
  await pg.query("ROLLBACK").catch(() => {});
  console.error("✘ Migration interrompue :", e.message);
  process.exitCode = 1;
} finally {
  pg.release();
  await src.end();
  await pool.end();
}
