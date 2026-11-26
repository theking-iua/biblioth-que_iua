// Import CSV des étudiants en ligne de commande (pratique pour les gros fichiers).
// Utilisation : npm run import:lecteurs -- C:\chemin\etudiants.csv
import fs from "node:fs/promises";
import { pool, tx } from "../src/db.js";
import { importReadersCsv } from "../src/import-readers.js";

const file = process.argv[2];
if (!file) {
  console.error("Utilisation : npm run import:lecteurs -- chemin/vers/etudiants.csv");
  process.exit(1);
}
try {
  const out = await tx(async (t) => importReadersCsv(t, null, await fs.readFile(file)));
  console.log(out.message);
  for (const e of out.errors) console.log(" - " + e);
} catch (e) {
  console.error("Échec de l'import :", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
