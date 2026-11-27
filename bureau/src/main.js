// PMB IUA Administration : application de bureau (Electron) qui embarque l'espace d'administration React.
//  - l'interface est servie depuis l'application (protocole app://admin), sans serveur web local
//  - l'adresse de l'API se règle dans l'appli (menu Fichier → Serveur…), enregistrée dans le profil Windows
//  - sécurité : isolation du contexte, pas d'accès Node dans la page, navigation limitée à l'appli
const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain, session, dialog, nativeTheme } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const ORIGIN = "app://admin";
const ADMIN_DIR = path.join(__dirname, "..", "app-admin");
const PAGES_DIR = path.join(__dirname, "..", "desktop-pages");
const CONFIG_FILE = () => path.join(app.getPath("userData"), "config.json");

// ---------------------------------------------------------------- Réglages (adresse du serveur, fenêtre)
const DEFAULTS = { apiUrl: "", mobileUrl: "", window: { width: 1360, height: 860, maximized: true } };
let config = { ...DEFAULTS };

function loadConfig() {
  try {
    config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")) };
  } catch {
    config = { ...DEFAULTS };
  }
}
function saveConfig() {
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(config, null, 2));
}
const cleanUrl = (u) => String(u || "").trim().replace(/\/+$/, "");
const apiOrigin = () => {
  try {
    return new URL(config.apiUrl).origin;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- Protocole app:// (avant « ready »)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function registerAppProtocol() {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    if (url.host !== "admin") return new Response("Introuvable", { status: 404 });
    let rel = decodeURIComponent(url.pathname);
    // Pages propres à l'appli de bureau (réglage du serveur…)
    let base = ADMIN_DIR;
    if (rel.startsWith("/__bureau/")) {
      base = PAGES_DIR;
      rel = rel.slice("/__bureau".length);
    }
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base)) return new Response("Interdit", { status: 403 });
    // Application monopage : toute route inconnue renvoie index.html
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(base, "index.html");
    return net.fetch(pathToFileURL(target).toString());
  });
}

// ---------------------------------------------------------------- Accès à l'API depuis app://admin
// L'API autorise l'origine app://admin (CORS_ORIGINS). Si le serveur n'a pas encore été mis à jour,
// on ajoute les en-têtes CORS aux réponses de l'API configurée (et seulement de celle-ci).
function allowApiCors() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const origin = apiOrigin();
    if (!origin || !details.url.startsWith(origin)) return callback({ responseHeaders: details.responseHeaders });
    const headers = { ...details.responseHeaders };
    for (const k of Object.keys(headers)) if (/^access-control-/i.test(k)) delete headers[k];
    headers["Access-Control-Allow-Origin"] = [ORIGIN];
    headers["Access-Control-Allow-Headers"] = ["Content-Type, Authorization"];
    headers["Access-Control-Allow-Methods"] = ["GET, POST, PUT, DELETE, OPTIONS"];
    const preflight = details.method === "OPTIONS";
    callback({ responseHeaders: headers, statusLine: preflight ? "HTTP/1.1 204 No Content" : details.statusLine });
  });
}

// ---------------------------------------------------------------- Fenêtres
let mainWindow = null;
let serverWindow = null;

function secure(win) {
  // Liens externes (PDF des mémoires, appli lecteur, emails) : navigateur ou logiciel par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${ORIGIN}/`)) return;
    event.preventDefault();
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

function createMainWindow() {
  const w = config.window || DEFAULTS.window;
  mainWindow = new BrowserWindow({
    width: w.width,
    height: w.height,
    x: w.x,
    y: w.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: "PMB IUA Administration",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0B1220" : "#F5F6FA",
    icon: path.join(__dirname, "..", "desktop-pages", "icon.png"),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  secure(mainWindow);
  mainWindow.webContents.session.setSpellCheckerLanguages(["fr"]);
  mainWindow.once("ready-to-show", () => {
    if (w.maximized) mainWindow.maximize();
    mainWindow.show();
  });
  // Mémoriser la taille et la position de la fenêtre
  mainWindow.on("close", () => {
    const maximized = mainWindow.isMaximized();
    const b = maximized ? config.window : mainWindow.getBounds();
    config.window = { ...b, maximized };
    saveConfig();
  });
  mainWindow.on("closed", () => (mainWindow = null));
  mainWindow.loadURL(`${ORIGIN}/`);
}

function openServerWindow(firstRun = false) {
  if (serverWindow) return serverWindow.focus();
  serverWindow = new BrowserWindow({
    width: 560,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: firstRun ? undefined : mainWindow || undefined,
    modal: !firstRun && !!mainWindow,
    title: "Serveur de la bibliothèque",
    backgroundColor: "#F5F6FA",
    icon: path.join(__dirname, "..", "desktop-pages", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  serverWindow.setMenu(null);
  secure(serverWindow);
  serverWindow.loadURL(`${ORIGIN}/__bureau/serveur.html${firstRun ? "?premier=1" : ""}`);
  serverWindow.on("closed", () => {
    serverWindow = null;
    // Premier lancement fermé sans réglage : on quitte
    if (firstRun && !config.apiUrl && !mainWindow) app.quit();
  });
}

// ---------------------------------------------------------------- Échanges avec les pages
ipcMain.on("config:get", (event) => {
  event.returnValue = { apiUrl: config.apiUrl, mobileUrl: config.mobileUrl, version: app.getVersion() };
});

ipcMain.handle("config:test", async (_e, url) => {
  const base = cleanUrl(url);
  if (!/^https?:\/\/[^\s]+$/i.test(base)) return { ok: false, message: "Adresse invalide : elle doit commencer par http:// ou https://." };
  try {
    const res = await net.fetch(`${base}/health`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok) return { ok: true, message: "Connexion réussie : le serveur et la base de données répondent." };
    if (data && data.ok === false) return { ok: false, message: "Le serveur répond, mais sa base de données est indisponible." };
    return { ok: false, message: `Le serveur a répondu avec l'erreur ${res.status}. Vérifiez que l'adresse se termine par /api.` };
  } catch (e) {
    return { ok: false, message: "Serveur injoignable. Vérifiez l'adresse et la connexion Internet." };
  }
});

ipcMain.handle("config:save", async (_e, values) => {
  const apiUrl = cleanUrl(values?.apiUrl);
  if (!/^https?:\/\/[^\s]+$/i.test(apiUrl)) return { ok: false, message: "Adresse de l'API invalide." };
  const changed = apiUrl !== config.apiUrl;
  config.apiUrl = apiUrl;
  config.mobileUrl = cleanUrl(values?.mobileUrl);
  saveConfig();
  buildMenu();
  if (serverWindow) serverWindow.close();
  if (!mainWindow) createMainWindow();
  else if (changed) {
    // Nouveau serveur : la session en cours n'y est pas valable
    await mainWindow.webContents.executeJavaScript("localStorage.removeItem('token'); localStorage.removeItem('user');").catch(() => {});
    mainWindow.loadURL(`${ORIGIN}/connexion`);
  } else mainWindow.reload();
  return { ok: true };
});

ipcMain.on("serveur:fermer", () => serverWindow?.close());

// ---------------------------------------------------------------- Menus
function buildMenu() {
  const send = (fn) => () => mainWindow && fn(mainWindow);
  const template = [
    {
      label: "Fichier",
      submenu: [
        { label: "Serveur de la bibliothèque…", accelerator: "CmdOrCtrl+,", click: () => openServerWindow(false) },
        { type: "separator" },
        { label: "Imprimer…", accelerator: "CmdOrCtrl+P", click: send((w) => w.webContents.print()) },
        { type: "separator" },
        { label: "Quitter", accelerator: "Alt+F4", role: "quit" },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { label: "Annuler", role: "undo" },
        { label: "Rétablir", role: "redo" },
        { type: "separator" },
        { label: "Couper", role: "cut" },
        { label: "Copier", role: "copy" },
        { label: "Coller", role: "paste" },
        { label: "Tout sélectionner", role: "selectAll" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { label: "Accueil", accelerator: "Alt+Home", click: send((w) => w.loadURL(`${ORIGIN}/`)) },
        { label: "Page précédente", accelerator: "Alt+Left", click: send((w) => w.webContents.navigationHistory.canGoBack() && w.webContents.navigationHistory.goBack()) },
        { label: "Actualiser", accelerator: "F5", click: send((w) => w.reload()) },
        { type: "separator" },
        { label: "Agrandir le texte", accelerator: "CmdOrCtrl+=", role: "zoomIn" },
        { label: "Réduire le texte", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "Taille normale", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
        { type: "separator" },
        { label: "Plein écran", accelerator: "F11", role: "togglefullscreen" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Ouvrir l'application des lecteurs",
          enabled: !!config.mobileUrl,
          click: () => config.mobileUrl && shell.openExternal(config.mobileUrl),
        },
        { label: "Outils de diagnostic", accelerator: "CmdOrCtrl+Shift+I", click: send((w) => w.webContents.toggleDevTools()) },
        { type: "separator" },
        {
          label: "À propos de PMB IUA Administration",
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "À propos",
              message: "PMB IUA Administration",
              detail:
                `Version ${app.getVersion()}\n` +
                `Serveur : ${config.apiUrl || "non configuré"}\n\n` +
                "Système intégré de gestion de bibliothèque\nInstitut Universitaire d'Abidjan — Service des Bibliothèques",
              buttons: ["OK"],
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- Démarrage
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = mainWindow || serverWindow;
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("ci.iua.bibliotheque.admin");
    loadConfig();
    // Adresse fournie au lancement (déploiement en masse) : PMB-IUA-Administration.exe --serveur=https://…/api
    const arg = process.argv.find((a) => a.startsWith("--serveur="));
    if (arg) {
      config.apiUrl = cleanUrl(arg.split("=").slice(1).join("="));
      saveConfig();
    }
    registerAppProtocol();
    allowApiCors();
    buildMenu();
    if (config.apiUrl) createMainWindow();
    else openServerWindow(true);
  });

  app.on("window-all-closed", () => app.quit());
}
