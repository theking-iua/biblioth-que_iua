// Fenêtre « Serveur de la bibliothèque » : saisie, test et enregistrement de l'adresse de l'API.
const $ = (id) => document.getElementById(id);
const desk = window.pmbDesktop;
const firstRun = new URLSearchParams(location.search).has("premier");

const status = (type, text) => {
  const el = $("status");
  el.hidden = !text;
  el.className = type;
  el.textContent = text || "";
};

$("apiUrl").value = desk.config.apiUrl || "";
$("mobileUrl").value = desk.config.mobileUrl || "";
$("version").textContent = `PMB IUA Administration, version ${desk.config.version}`;
if (firstRun) {
  $("intro").textContent = "Bienvenue ! Indiquez l'adresse du serveur de la bibliothèque pour commencer.";
  $("cancel").textContent = "Quitter";
}
$("apiUrl").focus();

$("test").addEventListener("click", async () => {
  $("test").disabled = true;
  status("info", "Test en cours…");
  const r = await desk.testServer($("apiUrl").value);
  status(r.ok ? "ok" : "err", r.message);
  $("test").disabled = false;
});

$("cancel").addEventListener("click", () => desk.closeServerWindow());

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("save").disabled = true;
  // On teste avant d'enregistrer, mais on laisse enregistrer un serveur momentanément éteint
  const t = await desk.testServer($("apiUrl").value);
  if (!t.ok && !confirm(`${t.message}\n\nEnregistrer quand même cette adresse ?`)) {
    status("err", t.message);
    $("save").disabled = false;
    return;
  }
  const r = await desk.saveConfig({ apiUrl: $("apiUrl").value, mobileUrl: $("mobileUrl").value });
  if (!r.ok) {
    status("err", r.message);
    $("save").disabled = false;
  }
});
