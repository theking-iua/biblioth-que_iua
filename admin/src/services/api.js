// Client de l'API PMB IUA (Node.js + Neon). Partagé à l'identique par l'appli admin et l'appli mobile.

// Application de bureau (Windows) : l'adresse du serveur est réglée dans l'appli (menu Fichier → Serveur)
const desktop = typeof window !== "undefined" ? window.pmbDesktop : undefined;
export const IS_DESKTOP = !!desktop;

// URL de l'API : réglage de l'appli de bureau, sinon variable VITE_API_URL dans .env (ex. https://api.biblio.iua.ci/api)
export const API_BASE_URL = (desktop?.config?.apiUrl || import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

// Session expirée / jeton invalide : on nettoie et on renvoie vers la connexion
function handleUnauthorized(endpoint) {
  if (endpoint.startsWith("login") || endpoint.startsWith("sso")) return;
  if (!localStorage.getItem("token")) return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  if (!window.location.pathname.startsWith("/connexion")) {
    window.location.assign("/connexion?expired=1");
  }
}

async function send(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const isForm = options.body instanceof FormData;
  const headers = {
    ...(isForm ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/${endpoint}`, { ...options, headers });
  } catch {
    throw new Error("Serveur injoignable. Vérifiez votre connexion Internet ou réessayez dans un instant.");
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (res.status === 401) handleUnauthorized(endpoint);
  if (!res.ok) {
    const errorMsg = data && data.error ? data.error : `Erreur ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }
  return data;
}

const request = (endpoint, options = {}) => send(endpoint, options);
const upload = (endpoint, formData) => send(endpoint, { method: "POST", body: formData });
const qs = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : "";
};
const json = (method, data) => ({ method, body: JSON.stringify(data) });

export const api = {
  // Authentification
  login: (email, password) => request("login", json("POST", { email, password })),
  getMe: () => request("me"),
  getSsoConfig: () => request("sso"),
  loginSSO: (idToken, nonce) => request("sso", json("POST", { id_token: idToken, nonce })),
  register: (userData) => request("members", json("POST", userData)),

  // Paramètres du SIGB
  getSettings: () => request("settings"),
  updateSettings: (data) => request("settings", json("PUT", data)),
  runDailyProcessing: () => request("daily-processing", { method: "POST" }),

  // Relance / message à un lecteur (personnel)
  sendNotification: (data) => request("notifications", json("POST", data)),

  // Import CSV des lecteurs (personnel)
  importReaders: (file) => {
    const fd = new FormData();
    fd.append("fichier", file);
    return upload("import-lecteurs", fd);
  },

  // Dépôt du PDF d'un mémoire (personnel)
  uploadMemoirePdf: (file) => {
    const fd = new FormData();
    fd.append("fichier", file);
    return upload("upload-memoire", fd);
  },

  // Circulation au comptoir par code-barres
  checkoutByBarcode: (codeBarre, lecteur) => request("loans", json("POST", { code_barre: codeBarre, lecteur })),
  checkinByBarcode: (codeBarre) => request("loans", json("PUT", { code_barre: codeBarre })),

  // Statistiques
  getDashboardStats: () => request("dashboard-stats"),
  getRealtimeAlerts: () => request("realtime-alerts"),

  // Catalogue & documents
  getDocuments: (params = {}) => request(`catalogue${qs(params)}`),
  getDocumentById: (id) => request(`catalogue?id=${id}`),
  createDocument: (data) => request("catalogue", json("POST", data)),
  updateDocument: (data) => request("catalogue", json("PUT", data)),
  deleteDocument: (id) => request(`catalogue?id=${id}`, { method: "DELETE" }),

  // Exemplaires
  getCopiesByDocument: (docId) => request(`copies?document_id=${docId}`),
  getAllCopies: () => request("copies"),
  createCopy: (data) => request("copies", json("POST", data)),
  updateCopy: (data) => request("copies", json("PUT", data)),
  deleteCopy: (id) => request(`copies?id=${id}`, { method: "DELETE" }),

  // Mémoires & thèses
  getDigitalResources: (params = {}) => request(`digital-resources${qs(params)}`),
  getDigitalResourceById: (id) => request(`digital-resources?id=${id}`),
  incrementDigitalView: (id) => request(`digital-resources?id=${id}&action=view`),
  incrementDigitalDownload: (id) => request(`digital-resources?id=${id}&action=download`),
  createDigitalResource: (data) => request("digital-resources", json("POST", data)),
  updateDigitalResource: (data) => request("digital-resources", json("PUT", data)),
  deleteDigitalResource: (id) => request(`digital-resources?id=${id}`, { method: "DELETE" }),

  // Prêts
  getLoans: (params = {}) => request(`loans${qs(params)}`),
  createLoan: (data) => request("loans", json("POST", data)),
  returnLoan: (id) => request("loans", json("PUT", { id })),

  // Demandes d'emprunt
  getBorrowRequests: (params = {}) => request(`borrow-requests${qs(params)}`),
  createBorrowRequest: (data) => request("borrow-requests", json("POST", data)),
  cancelBorrowRequest: (id) => request(`borrow-requests?id=${id}`, { method: "DELETE" }),
  approveBorrowRequest: (id) => request("borrow-requests", json("PUT", { id, action: "approve" })),
  rejectBorrowRequest: (id, _staffId, motif) => request("borrow-requests", json("PUT", { id, action: "reject", motif_refus: motif })),

  // Réservations
  getReservations: (params = {}) => request(`reservations${qs(params)}`),
  createReservation: (data) => request("reservations", json("POST", data)),
  cancelReservation: (id) => request(`reservations?id=${id}`, { method: "DELETE" }),

  // Prolongations
  renewLoan: (loanId) => request("renewals", json("POST", { loan_id: loanId })),

  // Favoris (de l'utilisateur connecté)
  getFavorites: () => request("favorites"),
  addFavorite: (_userId, docId) => request("favorites", json("POST", { document_id: docId })),
  removeFavorite: (_userId, docId) => request(`favorites?document_id=${docId}`, { method: "DELETE" }),

  // Notifications (de l'utilisateur connecté)
  getNotifications: () => request("notifications"),
  markNotificationRead: (id) => request("notifications", json("PUT", { id })),
  markAllNotificationsRead: () => request("notifications", json("PUT", { action: "mark_all_read" })),

  // Lecteurs
  getMembers: (params = {}) => request(`members${qs(params)}`),
  createMember: (data) => request("members", json("POST", data)),
  updateMember: (data) => request("members", json("PUT", data)),
  deleteMember: (id) => request(`members?id=${id}`, { method: "DELETE" }),

  // Photo de profil
  uploadPhoto: (userId, file) => {
    const formData = new FormData();
    formData.append("photo", file);
    if (userId) formData.append("user_id", userId);
    return upload("photo-upload", formData);
  },

  // Comptes du personnel (administrateurs)
  getAdminUsers: () => request("admin-users"),
  createAdminUser: (data) => request("admin-users", json("POST", data)),
  updateAdminUser: (data) => request("admin-users", json("PUT", data)),
  deleteAdminUser: (id) => request(`admin-users?id=${id}`, { method: "DELETE" }),

  // Référentiels
  getTaxonomies: (type) => request(`taxonomies?type=${type}`),
  getAllTaxonomies: () => request("taxonomies?all=1"),
  createTaxonomy: (type, data) => request(`taxonomies?type=${type}`, json("POST", data)),
  updateTaxonomy: (type, data) => request(`taxonomies?type=${type}`, json("PUT", data)),
  deleteTaxonomy: (type, id) => request(`taxonomies?type=${type}&id=${id}`, { method: "DELETE" }),

  // Journal d'activité (administrateurs)
  getActivityLogs: (params = {}) => request(`activity-logs${qs(params)}`),

  // URL publique d'un fichier déposé (PDF de mémoire…)
  getFileUrl: (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
  },

  // URL d'une photo de profil
  getPhotoUrl: (photoPath) => {
    if (!photoPath) return null;
    if (photoPath.startsWith("http")) return photoPath;
    return `${API_BASE_URL}/${photoPath.replace(/^\//, "")}`;
  },
};

export default api;
