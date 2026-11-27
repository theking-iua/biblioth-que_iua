// Après l'empaquetage Windows : icône et informations de version gravées dans le .exe
// (en JavaScript avec resedit : fonctionne aussi depuis Linux ou macOS, sans Wine).
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const PE = await import("pe-library");
  const pkg = context.packager.appInfo;
  const exe = path.join(context.appOutDir, `${pkg.productFilename}.exe`);
  const ico = path.join(context.packager.info.buildResourcesDir, "icon.ico");

  const exeFile = PE.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = PE.NtExecutableResource.from(exeFile);

  // Icône : remplace tous les groupes d'icônes existants
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  for (const g of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, iconFile.icons.map((i) => i.data));
  }

  // Informations de version visibles dans Propriétés → Détails
  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const v = pkg.version.split(".").map((n) => parseInt(n, 10) || 0);
  const version = `${v[0]}.${v[1] || 0}.${v[2] || 0}.0`;
  // Version de l'appli (et non celle d'Electron) dans la table existante, sans en créer une nouvelle
  vi.fixedInfo.fileVersionMS = (v[0] << 16) | (v[1] || 0);
  vi.fixedInfo.fileVersionLS = ((v[2] || 0) << 16) | 0;
  vi.fixedInfo.productVersionMS = vi.fixedInfo.fileVersionMS;
  vi.fixedInfo.productVersionLS = vi.fixedInfo.fileVersionLS;
  const strings = {
    FileVersion: version,
    ProductVersion: version,
    ProductName: pkg.productName,
    FileDescription: pkg.productName,
    CompanyName: "Institut Universitaire d'Abidjan",
    LegalCopyright: pkg.copyright || "© Institut Universitaire d'Abidjan",
    OriginalFilename: `${pkg.productFilename}.exe`,
    InternalName: pkg.productFilename,
  };
  for (const lang of vi.getAllLanguagesForStringValues()) vi.setStringValues(lang, strings);
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exeFile);
  fs.writeFileSync(exe, Buffer.from(exeFile.generate()));
  console.log(`  • icône et version gravées dans ${path.basename(exe)}`);
};
