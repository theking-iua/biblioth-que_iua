import React, { useState, useEffect } from "react";
import {
  Clock,
  Search,
  ShieldCheck,
  ShieldAlert,
  Filter,
  RefreshCcw,
  UserCheck,
  BookOpen,
  GraduationCap,
  Bookmark,
  Users,
  Eye,
  X,
  Calendar,
  Layers,
  KeyRound,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../components/common/Toast";

export default function ActivityLogsPage() {
  const { user, isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [isAdmin]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getActivityLogs({ limit: 200 });
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast(e.message || "Erreur de chargement du journal des logs", "error");
    } finally {
      setLoading(false);
    }
  };

  // Sécurité frontend stricte : Seul l'Admin a accès
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-navy-800 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="font-display text-2xl font-bold text-navy-800 dark:text-white">
          Accès Strictement Réservé à l'Administrateur
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
          Le journal d'activité et d'audit du système PMB IUA contient des données de sécurité sensibles et n'est accessible qu'aux comptes administrateurs.
        </p>
      </div>
    );
  }

  // Filtrage intelligent
  const filtered = logs.filter((l) => {
    const textMatch =
      (l.action + " " + (l.user_name || "") + " " + (l.cible_type || "") + " " + (l.user_role || ""))
        .toLowerCase()
        .includes(search.toLowerCase());

    if (!textMatch) return false;

    if (categoryFilter === "auth") {
      return (
        l.cible_type === "auth" ||
        l.action.toLowerCase().includes("connexion") ||
        l.action.toLowerCase().includes("authentification")
      );
    }
    if (categoryFilter === "loans") {
      return (
        l.cible_type === "loan" ||
        l.action.toLowerCase().includes("emprunt") ||
        l.action.toLowerCase().includes("retour") ||
        l.action.toLowerCase().includes("prolongation")
      );
    }
    if (categoryFilter === "reservations") {
      return (
        l.cible_type === "reservation" ||
        l.cible_type === "borrow_request" ||
        l.action.toLowerCase().includes("demande") ||
        l.action.toLowerCase().includes("réservation")
      );
    }
    if (categoryFilter === "memoires") {
      return (
        l.cible_type === "digital_resource" ||
        l.action.toLowerCase().includes("mémoire") ||
        l.action.toLowerCase().includes("thèse")
      );
    }
    if (categoryFilter === "catalogue") {
      return (
        l.cible_type === "document" ||
        l.cible_type === "copy" ||
        l.cible_type === "categories" ||
        l.action.toLowerCase().includes("catalogue") ||
        l.action.toLowerCase().includes("exemplaire")
      );
    }
    if (categoryFilter === "users") {
      return (
        l.cible_type === "user" ||
        l.action.toLowerCase().includes("compte") ||
        l.action.toLowerCase().includes("visiteur") ||
        l.action.toLowerCase().includes("adhérent")
      );
    }

    return true;
  });

  // Métriques d'audit rapides
  const totalCount = logs.length;
  const authCount = logs.filter((l) => l.action.toLowerCase().includes("connexion")).length;
  const loansCount = logs.filter(
    (l) => l.cible_type === "loan" || l.action.toLowerCase().includes("emprunt")
  ).length;
  const memoiresCount = logs.filter(
    (l) => l.cible_type === "digital_resource" || l.action.toLowerCase().includes("mémoire")
  ).length;

  const getActionBadge = (action, cibleType) => {
    const act = action.toLowerCase();
    if (act.includes("connexion réussie")) {
      return {
        bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        icon: KeyRound,
      };
    }
    if (act.includes("échec") || act.includes("suppression") || act.includes("annul")) {
      return {
        bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
        icon: ShieldAlert,
      };
    }
    if (act.includes("emprunt") || act.includes("retour") || act.includes("prolongation")) {
      return {
        bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        icon: Bookmark,
      };
    }
    if (act.includes("mémoire") || act.includes("lecture") || act.includes("téléchargement")) {
      return {
        bg: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
        icon: GraduationCap,
      };
    }
    if (act.includes("visiteur") || act.includes("adhérent") || act.includes("utilisateur")) {
      return {
        bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
        icon: Users,
      };
    }
    return {
      bg: "bg-gray-50 text-gray-700 dark:bg-navy-700 dark:text-gray-300 border-gray-200 dark:border-navy-600",
      icon: Clock,
    };
  };

  const getRoleBadge = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") {
      return "bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
    if (r === "bibliothecaire") {
      return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    if (r === "visiteur" || r === "adherent") {
      return "bg-sky-100 dark:bg-navy-700 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-navy-600";
    }
    return "bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 border-gray-200";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
              Journal d'Activité & Audit SIGB
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Confidentiel Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Traçabilité intégrale des connexions, emprunts, retours, gestions de visiteurs, consultations et modifications système.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-4 py-2.5 rounded-xl bg-navy-800 dark:bg-sky-brand text-white text-xs font-bold uppercase tracking-wider shadow-md hover:bg-navy-700 flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          Actualiser le journal
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Total Événements</span>
          <p className="font-display text-2xl font-bold text-navy-800 dark:text-white mt-1">{totalCount}</p>
          <span className="text-[10px] text-sky-brand font-semibold">Traçabilité continue</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Connexions portail</span>
          <p className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{authCount}</p>
          <span className="text-[10px] text-gray-400">Accès utilisateurs & staff</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Mouvements Prêts</span>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{loansCount}</p>
          <span className="text-[10px] text-gray-400">Emprunts, retours & prolongations</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Consultations Thèses</span>
          <p className="font-display text-2xl font-bold text-sky-deep dark:text-sky-brand mt-1">{memoiresCount}</p>
          <span className="text-[10px] text-gray-400">Lectures en ligne & downloads</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-5 border-b border-gray-200 dark:border-navy-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {[
              { id: "all", label: "Tous" },
              { id: "auth", label: "Sécurité & Connexions" },
              { id: "loans", label: "Prêts & Retours" },
              { id: "reservations", label: "Demandes & Réservations" },
              { id: "memoires", label: "Thèses & Mémoires" },
              { id: "catalogue", label: "Catalogue & Fonds" },
              { id: "users", label: "Visiteurs & Comptes" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCategoryFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  categoryFilter === f.id
                    ? "bg-sky-brand text-white shadow-sm"
                    : "bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher action, utilisateur, IP..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-xs text-navy-800 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Horodatage</th>
                <th className="px-6 py-4">Utilisateur & Rôle</th>
                <th className="px-6 py-4">Action Enregistrée</th>
                <th className="px-6 py-4">Module Cible</th>
                <th className="px-6 py-4">Adresse IP</th>
                <th className="px-6 py-4 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((l) => {
                const badge = getActionBadge(l.action, l.cible_type);
                const Icon = badge.icon;
                return (
                  <tr key={l.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(l.date).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-800 dark:text-white">
                          {l.user_name || "Système"}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${getRoleBadge(
                            l.user_role
                          )}`}
                        >
                          {l.user_role || "visiteur"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg border flex-shrink-0 ${badge.bg}`}
                        >
                          <Icon size={14} />
                        </div>
                        <span className="font-medium text-navy-800 dark:text-gray-200">
                          {l.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full bg-sky-pale dark:bg-navy-700 text-sky-deep dark:text-sky-brand font-medium text-[11px]">
                        {l.cible_type || "Système"} {l.cible_id ? `#${l.cible_id}` : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-400 text-[11px] whitespace-nowrap">
                      {l.ip_address || "127.0.0.1"}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700 transition-colors"
                        title="Voir le détail de l'événement"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucun événement ne correspond à vos critères de recherche.
            </div>
          )}
        </div>
      </div>

      {/* Modal Détails Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-sky-brand" size={20} />
                <h2 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                  Détail de l'Audit Log #{selectedLog.id}
                </h2>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-navy-700">
                <span className="text-gray-400">Date & Heure :</span>
                <strong className="font-mono text-navy-800 dark:text-white">
                  {new Date(selectedLog.date).toLocaleString("fr-FR")}
                </strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-navy-700">
                <span className="text-gray-400">Utilisateur responsable :</span>
                <span className="font-bold text-navy-800 dark:text-white">
                  {selectedLog.user_name} ({selectedLog.user_role})
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-navy-700">
                <span className="text-gray-400">Action :</span>
                <span className="font-semibold text-navy-800 dark:text-white text-right">
                  {selectedLog.action}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-navy-700">
                <span className="text-gray-400">Module & Cible :</span>
                <span className="font-mono text-sky-deep dark:text-sky-brand">
                  {selectedLog.cible_type || "N/A"} {selectedLog.cible_id ? `(ID: ${selectedLog.cible_id})` : ""}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-navy-700">
                <span className="text-gray-400">Adresse IP cliente :</span>
                <span className="font-mono text-gray-600 dark:text-gray-300">
                  {selectedLog.ip_address || "127.0.0.1"}
                </span>
              </div>

              {selectedLog.details && (
                <div className="pt-2">
                  <span className="text-gray-400 block mb-1">Payload / Détails enregistrés :</span>
                  <pre className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-[11px] font-mono overflow-x-auto text-navy-800 dark:text-gray-200 whitespace-pre-wrap">
                    {typeof selectedLog.details === "object"
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : selectedLog.details}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-navy-700">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-navy-800 dark:bg-sky-brand text-white font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
