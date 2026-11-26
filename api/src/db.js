// db.js : accès PostgreSQL (Neon) via node-postgres.
//  - les requêtes s'écrivent avec des « ? » comme sous PDO ; ils sont convertis en $1, $2…
//  - les entiers (COUNT, SUM…) et les dates sont renvoyés au même format que l'ancienne API PHP/MySQL
//  - tx(fn) exécute fn dans une transaction (COMMIT ou ROLLBACK automatique)
import pg from "pg";
import { config } from "./config.js";

const { types } = pg;
// BIGINT (COUNT) et NUMERIC (SUM) → nombres JS, comme PDO MySQL
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));
// TIMESTAMP / DATE → chaîne « AAAA-MM-JJ HH:MM:SS » (format MySQL attendu par les interfaces)
types.setTypeParser(1114, (v) => v.split(".")[0]);
types.setTypeParser(1082, (v) => v);

function needsSsl(url) {
  return /sslmode=(require|verify-full|verify-ca)/.test(url) || /\.neon\.tech/.test(url);
}

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: needsSsl(config.databaseUrl) ? { rejectUnauthorized: true } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // Neon peut mettre quelques secondes à réveiller une base en veille
});
pool.on("error", (err) => console.error("[PMB IUA] Erreur du pool PostgreSQL :", err.message));

/** Convertit les « ? » (hors chaînes littérales) en paramètres PostgreSQL $1, $2… */
export function toPg(sql) {
  let out = "";
  let n = 0;
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inStr = !inStr;
    if (c === "?" && !inStr) out += "$" + ++n;
    else out += c;
  }
  return out;
}

/** Petit exécuteur commun au pool et aux transactions. */
class Exec {
  constructor(client) {
    this.client = client;
  }
  async query(sql, params = []) {
    return this.client.query(toPg(sql), params);
  }
  async all(sql, params) {
    return (await this.query(sql, params)).rows;
  }
  async one(sql, params) {
    return (await this.query(sql, params)).rows[0] || null;
  }
  async val(sql, params) {
    const row = await this.one(sql, params);
    return row ? Object.values(row)[0] : null;
  }
  async run(sql, params) {
    return (await this.query(sql, params)).rowCount;
  }
  /** INSERT … : renvoie l'id créé (ajoute RETURNING id). */
  async insert(sql, params) {
    const row = await this.one(sql.replace(/;?\s*$/, "") + " RETURNING id", params);
    return row ? row.id : null;
  }
}

export const db = new Exec(pool);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(new Exec(client));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- Paramètres du SIGB (table settings)
let settingsCache = null;
let settingsAt = 0;

export async function setting(key, def = null, ex = db) {
  if (!settingsCache || Date.now() - settingsAt > 30_000) {
    const rows = await ex.all("SELECT cle, valeur FROM settings");
    settingsCache = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
    settingsAt = Date.now();
  }
  return settingsCache[key] ?? def;
}

export function invalidateSettings() {
  settingsCache = null;
}

/** Heure locale de la bibliothèque, au format « AAAA-MM-JJ HH:MM:SS ». */
export function sqlDate(d) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
  return parts.replace("T", " ");
}

/** Interprète une date « AAAA-MM-JJ HH:MM:SS » (heure de la bibliothèque) en Date JS. */
export function parseSqlDate(s) {
  // Calcul du décalage du fuseau à cet instant (Abidjan = 0, mais reste correct ailleurs)
  const asUtc = new Date(String(s).replace(" ", "T") + "Z");
  const local = new Date(sqlDate(asUtc).replace(" ", "T") + "Z");
  return new Date(asUtc.getTime() - (local.getTime() - asUtc.getTime()));
}

/** Format JJ/MM/AAAA (et « à HH:MM » si withTime). */
export function frDate(s, withTime = false) {
  const [d, t] = String(s).split(" ");
  const [y, m, j] = d.split("-");
  return `${j}/${m}/${y}` + (withTime && t ? ` à ${t.slice(0, 5)}` : "");
}
