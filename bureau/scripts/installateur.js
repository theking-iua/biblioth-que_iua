// Fabrique l'installateur Windows (.exe) avec NSIS à partir de release/win-unpacked.
// Fonctionne sous Windows (NSIS installé : https://nsis.sourceforge.io), Linux (apt install nsis) ou macOS (brew install makensis).
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const source = path.join(root, "release", "win-unpacked");
const out = path.join(root, "release", `PMB-IUA-Administration-Setup-${pkg.version}.exe`);

if (!fs.existsSync(path.join(source, `${pkg.build.productName}.exe`))) {
  console.error("release/win-unpacked introuvable : lancez d'abord « electron-builder --win --x64 --dir ».");
  process.exit(1);
}

const candidates = ["makensis", "C:\\Program Files (x86)\\NSIS\\makensis.exe", "C:\\Program Files\\NSIS\\makensis.exe"];
const makensis = candidates.find((c) => {
  try {
    execFileSync(c, ["-VERSION"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});
if (!makensis) {
  console.error("makensis introuvable. Installez NSIS (https://nsis.sourceforge.io/Download) puis relancez.");
  process.exit(1);
}

const sep = process.platform === "win32" ? "/" : "-";
execFileSync(
  makensis,
  [
    `${sep}V2`,
    `${sep}DAPP_VERSION=${pkg.version}`,
    `${sep}DSOURCE_DIR=${source}`,
    `${sep}DICON=${path.join(root, "build", "icon.ico")}`,
    `${sep}DOUTFILE=${out}`,
    path.join(root, "installer", "installateur.nsi"),
  ],
  { stdio: "inherit" }
);
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`\n✔ Installateur créé : ${path.relative(root, out)} (${mb} Mo)`);
