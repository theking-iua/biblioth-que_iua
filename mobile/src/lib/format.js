// Dates de l'API : « AAAA-MM-JJ HH:MM:SS » (heure de la bibliothèque, Abidjan = UTC+0).
export function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Nombre de jours calendaires jusqu'à la date (négatif si dépassée). */
export function daysUntil(s) {
  const d = parseDate(s);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
}

export function shortDate(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
}

export function longDate(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "";
}

export function dateTime(s) {
  const d = parseDate(s);
  return d ? d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

/** « il y a 3 h », « hier »… pour les notifications. */
export function relative(s) {
  const d = parseDate(s);
  if (!d) return "";
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = daysUntil(s) * -1;
  if (j === 1) return "hier";
  if (j < 7) return `il y a ${j} jours`;
  return shortDate(s);
}

/** Texte d'échéance d'un prêt. */
export function dueLabel(s) {
  const n = daysUntil(s);
  if (n === null) return "";
  if (n < 0) return `${-n} j de retard`;
  if (n === 0) return "À rendre aujourd'hui";
  if (n === 1) return "À rendre demain";
  return `À rendre dans ${n} jours`;
}

export const fullName = (u) => [u?.prenom, u?.nom].filter(Boolean).join(" ");
export const initials = (u) => ((u?.prenom?.[0] || "") + (u?.nom?.[0] || "")).toUpperCase() || "?";

export const TYPE_LABELS = { livre: "Livre", memoire: "Mémoire", these: "Thèse", revue: "Revue", cours: "Cours" };
