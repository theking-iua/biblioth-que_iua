// Client de l'API PMB IUA (même API que les applis web).
// Adresse du serveur : réglage enregistré dans l'appli (écran « Serveur »), sinon EXPO_PUBLIC_API_URL fixé au build.
import { storage } from "./storage";

export const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.10:4000/api").replace(/\/$/, "");

let baseUrl = DEFAULT_API_URL;
let token = null;
let onUnauthorized = () => {};

export const getApiUrl = () => baseUrl;
export async function loadApiUrl() {
  const saved = await storage.get("api_url");
  if (saved) baseUrl = saved;
  return baseUrl;
}
export async function setApiUrl(url) {
  const clean = String(url || "").trim().replace(/\/$/, "");
  baseUrl = clean || DEFAULT_API_URL;
  if (clean && clean !== DEFAULT_API_URL) await storage.set("api_url", clean);
  else await storage.remove("api_url");
  return baseUrl;
}

export const setToken = (t) => {
  token = t;
};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function send(endpoint, { method = "GET", body, form, timeout = 20000 } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${baseUrl}/${endpoint}`, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: ctrl.signal,
    });
  } catch {
    throw new Error("Serveur injoignable. Vérifiez votre connexion Internet (ou l'adresse du serveur dans Profil > Serveur).");
  } finally {
    clearTimeout(timer);
  }

  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.text();
  if (res.status === 401 && token && !endpoint.startsWith("login") && !endpoint.startsWith("sso")) onUnauthorized();
  if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`);
  return data;
}

const qs = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return q ? `?${q}` : "";
};

export const api = {
  health: () => send("health", { timeout: 8000 }),
  login: (email, password) => send("login", { method: "POST", body: { email, password } }),
  me: () => send("me"),
  register: (data) => send("members", { method: "POST", body: data }),
  updateMember: (data) => send("members", { method: "PUT", body: data }),
  uploadPhoto: (asset) => {
    const fd = new FormData();
    const name = asset.fileName || `photo.${(asset.mimeType || "image/jpeg").split("/")[1]}`;
    fd.append("photo", { uri: asset.uri, name, type: asset.mimeType || "image/jpeg" });
    return send("photo-upload", { method: "POST", form: fd, timeout: 60000 });
  },

  settings: () => send("settings"),
  stats: () => send("dashboard-stats"),
  categories: () => send("taxonomies?type=categories"),

  documents: (params) => send(`catalogue${qs(params)}`),
  document: (id) => send(`catalogue?id=${id}`),
  memoires: (params) => send(`digital-resources${qs(params)}`),
  memoireView: (id) => send(`digital-resources?id=${id}&action=view`),
  memoireDownload: (id) => send(`digital-resources?id=${id}&action=download`),

  loans: () => send("loans"),
  renew: (loanId) => send("renewals", { method: "POST", body: { loan_id: loanId } }),
  requests: () => send("borrow-requests"),
  createRequest: (documentId) => send("borrow-requests", { method: "POST", body: { document_id: documentId } }),
  cancelRequest: (id) => send(`borrow-requests?id=${id}`, { method: "DELETE" }),
  reservations: () => send("reservations"),
  reserve: (documentId) => send("reservations", { method: "POST", body: { document_id: documentId } }),
  cancelReservation: (id) => send(`reservations?id=${id}`, { method: "DELETE" }),

  favorites: () => send("favorites"),
  addFavorite: (documentId) => send("favorites", { method: "POST", body: { document_id: documentId } }),
  removeFavorite: (documentId) => send(`favorites?document_id=${documentId}`, { method: "DELETE" }),

  notifications: () => send("notifications"),
  markRead: (id) => send("notifications", { method: "PUT", body: { id } }),
  markAllRead: () => send("notifications", { method: "PUT", body: { action: "mark_all_read" } }),

  fileUrl: (path) => (!path ? null : path.startsWith("http") ? path : `${baseUrl}/${path.replace(/^\//, "")}`),
};

export default api;
