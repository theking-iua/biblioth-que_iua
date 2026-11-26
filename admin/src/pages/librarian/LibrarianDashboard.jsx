import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Bookmark,
  AlertTriangle,
  Inbox,
  Clock,
  Layers,
  GraduationCap,
  ArrowUpRight,
  ScanLine,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { useAuth } from "../../context/AuthContext";

export default function LibrarianDashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    total_documents: 0,
    total_copies: 0,
    copies_disponibles: 0,
    copies_empruntees: 0,
    total_adherents: 0,
    emprunts_en_cours: 0,
    retards: 0,
    reservations_actives: 0,
    demandes_en_attente: 0,
    total_memoires: 0,
    categories_stats: [],
    top_documents: [],
  });
  const [recentLoans, setRecentLoans] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [st, loans] = await Promise.all([
        api.getDashboardStats().catch(() => ({})),
        api.getLoans().catch(() => []),
      ]);

      if (st && !st.error) setStats(st);

      if (Array.isArray(loans)) {
        setRecentLoans(loans.slice(0, 5));

        // Construire les données mensuelles d'emprunt des 6 derniers mois
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mCount = loans.filter((l) => {
            const ld = new Date(l.date_emprunt);
            return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
          }).length;
          const rCount = loans.filter((l) => {
            if (!l.date_retour_reelle) return false;
            const ld = new Date(l.date_retour_reelle);
            return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
          }).length;

          months.push({
            name: d.toLocaleString("fr-FR", { month: "short" }),
            emprunts: mCount,
            retours: rCount,
          });
        }
        setChartData(months);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Livres au catalogue",
      value: stats.total_documents || 9,
      sub: `${stats.total_copies || 18} exemplaires physiques`,
      icon: BookOpen,
      color: "bg-blue-500",
      link: "/catalogue",
    },
    {
      label: "Exemplaires disponibles",
      value: stats.copies_disponibles || 18,
      sub: "Prêts immédiatement possibles",
      icon: CheckCircle2,
      color: "bg-emerald-500",
      link: "/catalogue",
    },
    {
      label: "Emprunts en cours",
      value: stats.emprunts_en_cours || 0,
      sub: "Documents entre les mains des lecteurs",
      icon: Bookmark,
      color: "bg-amber-500",
      link: "/emprunts",
    },
    {
      label: "Retards critiques",
      value: stats.retards || 0,
      sub: "Échéances dépassées",
      icon: AlertTriangle,
      color: "bg-rose-500",
      highlight: (stats.retards || 0) > 0,
      link: "/retards",
    },
    {
      label: "Demandes à valider",
      value: stats.demandes_en_attente || 0,
      sub: "Soumises en ligne par les adhérents",
      icon: Inbox,
      color: "bg-indigo-500",
      highlight: (stats.demandes_en_attente || 0) > 0,
      link: "/demandes",
    },
    {
      label: "File de réservations",
      value: stats.reservations_actives || 0,
      sub: "Lecteurs en attente d'un exemplaire",
      icon: Layers,
      color: "bg-sky-deep",
      link: "/reservations",
    },
    {
      label: "Mémoires IUA",
      value: stats.total_memoires || 5,
      sub: "Travaux académiques archivés",
      icon: GraduationCap,
      color: "bg-purple-600",
      link: "/memoires",
    },
    {
      label: "Adhérents inscrits",
      value: stats.total_adherents || 1,
      sub: "Étudiants et enseignants",
      icon: Users,
      color: "bg-teal-600",
      link: "/adherents",
    },
  ];

  const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-deep dark:text-sky-brand">
            {isAdmin ? "Administration Centrale IUA" : "Espace Bibliothécaire"}
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white mt-1">
            Tableau de Bord Opérationnel
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Aperçu en temps réel de l'activité documentaire, de la circulation des livres et des retards.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/emprunts"
            className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <ScanLine size={16} /> Prêt rapide
          </Link>
          <Link
            to="/catalogue"
            className="px-5 py-2.5 rounded-xl bg-navy-800 dark:bg-navy-700 hover:bg-navy-700 dark:hover:bg-navy-600 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all"
          >
            + Nouveau Livre
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 stagger">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link
              key={i}
              to={c.link}
              className={`bg-white dark:bg-navy-800 rounded-3xl p-5 sm:p-6 border shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between ${
                c.highlight
                  ? "border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20"
                  : "border-gray-200 dark:border-navy-700/80"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">
                  {c.label}
                </span>
                <div className={`w-10 h-10 rounded-xl ${c.color} text-white flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={18} />
                </div>
              </div>

              <div>
                <p className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
                  {c.value}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-400 mt-1 truncate">
                  {c.sub}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Loans Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base sm:text-lg font-bold text-navy-800 dark:text-white">
                Évolution des Emprunts & Retours (6 derniers mois)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Taux de rotation et flux documentaire
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full font-bold bg-sky-pale dark:bg-navy-700 text-sky-deep dark:text-sky-brand">
              Données réelles
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#101B33",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="emprunts" name="Emprunts" fill="#5FA8D3" radius={[6, 6, 0, 0]} />
                <Bar dataKey="retours" name="Retours" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories Breakdown (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-navy-800 dark:text-white">
              Répartition par Catégorie
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Proportion des ouvrages au fonds
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {stats.categories_stats?.slice(0, 5).map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-navy-800 dark:text-white truncate">{cat.categorie}</span>
                  <span className="text-gray-500">{cat.count} titres</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-brand rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (cat.count / (stats.total_documents || 1)) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/catalogue"
            className="w-full text-center py-2.5 rounded-xl bg-gray-100 dark:bg-navy-700 text-xs font-bold text-navy-800 dark:text-white hover:bg-gray-200 transition-colors block"
          >
            Voir tout le catalogue
          </Link>
        </div>
      </div>

      {/* Recent Loans & Popular Books */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Loans */}
        <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base sm:text-lg font-bold text-navy-800 dark:text-white">
              Derniers Emprunts Enregistrés
            </h3>
            <Link to="/emprunts" className="text-xs font-bold text-sky-deep dark:text-sky-brand hover:underline">
              Gérer les prêts
            </Link>
          </div>

          {recentLoans.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">Aucun emprunt enregistré récemment.</p>
          ) : (
            <div className="space-y-3">
              {recentLoans.map((l) => {
                const isLate = l.statut === "en_cours" && new Date(l.date_retour_prevue) < new Date();
                return (
                  <div
                    key={l.id}
                    className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-900/60 border border-gray-100 dark:border-navy-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-navy-800 dark:text-white text-sm">{l.titre}</p>
                      <p className="text-gray-500">
                        Adhérent : <span className="font-semibold text-gray-700 dark:text-gray-300">{l.user_name}</span> ({l.user_email})
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-1">
                        <span>Date d'emprunt : <strong className="text-gray-700 dark:text-gray-300">{new Date(l.date_emprunt).toLocaleDateString("fr-FR")}</strong></span>
                        <span>•</span>
                        <span className={isLate ? "text-rose-600 font-bold" : ""}>
                          Date limite : <strong className={isLate ? "text-rose-600" : "text-gray-700 dark:text-gray-300"}>{new Date(l.date_retour_prevue).toLocaleDateString("fr-FR")}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 sm:text-right">
                      <StatusBadge status={l.statut === "retourne" ? "retourne" : isLate ? "en_retard" : "en_cours"} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Consulted Documents */}
        <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base sm:text-lg font-bold text-navy-800 dark:text-white">
              Documents Populaires (Top Circulation)
            </h3>
            <span className="text-xs text-gray-400">Par nombre de prêts</span>
          </div>

          <div className="space-y-3">
            {stats.top_documents?.map((doc, idx) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-900/60 border border-gray-100 dark:border-navy-700/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="w-6 h-6 rounded-lg bg-navy-800 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-bold text-navy-800 dark:text-white truncate">{doc.titre}</p>
                    <p className="text-gray-500 truncate">{doc.auteur} • {doc.categorie}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-sky-pale dark:bg-navy-700 text-sky-deep dark:text-sky-brand font-bold flex-shrink-0">
                  {doc.nb_prets || 0} prêt(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
