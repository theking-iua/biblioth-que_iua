// Copie l'espace admin compilé (../admin/dist) dans l'application de bureau (app-admin/).
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "..", "admin", "dist");
const dest = path.join(__dirname, "..", "app-admin");
if (!fs.existsSync(path.join(src, "index.html"))) {
  console.error("admin/dist introuvable : lancez d'abord « npm --prefix ../admin run build ».");
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Espace admin copié dans ${dest}`);
