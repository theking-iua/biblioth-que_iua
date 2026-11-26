import React from "react";

export default function StatusBadge({ status, text, className = "" }) {
  const s = String(status).toLowerCase();

  let bg = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  let dot = "bg-gray-400";
  let label = text || status;

  if (s === "disponible" || s === "1" || s === "true") {
    bg = "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60";
    dot = "bg-emerald-500";
    label = text || "Disponible";
  } else if (s === "emprunte" || s === "en_cours" || s === "0" || s === "false") {
    bg = "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60";
    dot = "bg-amber-500";
    label = text || "Emprunté";
  } else if (s === "en_retard" || s === "retard") {
    bg = "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60";
    dot = "bg-rose-500 animate-pulse";
    label = text || "En retard";
  } else if (s === "reserve" || s === "prete") {
    bg = "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60";
    dot = "bg-sky-500";
    label = text || "Réservé";
  } else if (s === "en_attente" || s === "demande") {
    bg = "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60";
    dot = "bg-indigo-500";
    label = text || "En attente";
  } else if (s === "retourne") {
    bg = "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800/60";
    dot = "bg-green-500";
    label = text || "Retourné";
  } else if (s === "validee") {
    bg = "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/60";
    dot = "bg-teal-500";
    label = text || "Validée";
  } else if (s === "refusee" || s === "annulee") {
    bg = "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
    dot = "bg-gray-400";
    label = text || (s === "refusee" ? "Refusée" : "Annulée");
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
      {label}
    </span>
  );
}
