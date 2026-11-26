import { API_BASE_URL } from "../../services/api";
import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ScanLine,
  Bookmark,
  Clock,
  BarChart3,
  LogOut,
  User,
  GraduationCap,
  Layers,
  Inbox,
  AlertTriangle,
  Settings,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  Bell,
  Library,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

export default function StaffShell({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const { alerts } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/connexion");
  };

  const navItems = [
    {
      group: "PRINCIPAL",
      items: [
        { path: "/", label: "Tableau de bord", icon: LayoutDashboard },
        {
          path: "/demandes",
          label: "Demandes d'emprunt",
          icon: Inbox,
          badge: alerts.demandes_en_attente,
          badgeColor: "bg-blue-600",
        },
        { path: "/emprunts", label: "Prêts & Retours", icon: ScanLine },
        {
          path: "/retards",
          label: "Suivi des Retards",
          icon: AlertTriangle,
          badge: alerts.retards_critiques,
          badgeColor: "bg-red-500",
        },
        { path: "/reservations", label: "Réservations", icon: Bookmark },
      ],
    },
    {
      group: "FONDS DOCUMENTAIRE",
      items: [
        { path: "/catalogue", label: "Catalogue & Exemplaires", icon: BookOpen },
        { path: "/memoires", label: "Mémoires & Thèses", icon: GraduationCap },
        { path: "/adherents", label: "Adhérents", icon: Users },
        { path: "/visiteurs", label: "Visiteurs", icon: User },
      ],
    },
    ...(isAdmin
      ? [
          {
            group: "ADMINISTRATION",
            items: [
              { path: "/utilisateurs", label: "Comptes Staff", icon: ShieldCheck },
              { path: "/referentiels", label: "Référentiels", icon: Layers },
              { path: "/rapports", label: "Rapports & Stats", icon: BarChart3 },
              { path: "/journal", label: "Journal d'activité", icon: Clock },
              { path: "/parametres", label: "Paramètres", icon: Settings },
            ],
          },
        ]
      : []),
  ];

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const photoUrl = user?.photo
    ? `${API_BASE_URL}/${user.photo}`
    : null;

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 font-body">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR Bleu Nuit ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 flex flex-col bg-navy-900 border-r border-navy-800 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-navy-800/80">
          <img
            src="/logo-iua.png"
            alt="IUA Logo"
            className="w-9 h-9 object-contain rounded-xl bg-white p-1 shadow-sm flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-tight tracking-wide">PMB IUA</p>
            <p className="text-[11px] text-sky-brand font-medium truncate">
              {isAdmin ? "Administration Centrale" : "Espace Bibliothécaire"}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden ml-auto text-gray-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navItems.map((section, idx) => (
            <div key={idx}>
              <p className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                {section.group}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        active
                          ? "bg-navy-800 text-white font-semibold shadow-md border border-navy-700/80"
                          : "text-gray-300 hover:bg-navy-800/60 hover:text-white"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sky-brand transition-transform duration-300 origin-center ${active ? "scale-y-100" : "scale-y-0"}`}
                      />
                      <div className="flex items-center gap-2.5 transition-transform duration-200 group-hover:translate-x-0.5">
                        <Icon
                          size={17}
                          className={active ? "text-sky-brand" : "text-gray-400 group-hover:text-gray-200"}
                        />
                        <span className={active ? "font-semibold text-white" : ""}>{item.label}</span>
                      </div>
                      {item.badge > 0 && (
                        <span
                          className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full ${item.badgeColor} badge-pulse`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className="border-t border-navy-800/80 p-3 bg-navy-950/40">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-navy-800/50 transition-colors">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-navy-800 border border-navy-700 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sky-brand font-bold text-sm uppercase">
                  {user?.nom?.substring(0, 2) || "ST"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {user?.nom} {user?.prenom || ""}
              </p>
              <p className="text-[10px] text-gray-400 capitalize truncate">
                {isAdmin ? "Administrateur" : "Bibliothécaire"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <Menu size={19} />
            </button>
            <div>
              <h2 className="text-sm font-bold text-gray-900 hidden sm:block">
                Portail Bibliothèque — Institut Universitaire d'Abidjan
              </h2>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                Système Intégré de Gestion de Bibliothèque (SIGB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Alertes rapides */}
            {alerts.demandes_en_attente > 0 && (
              <Link
                to="/demandes"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                <Bell size={13} className="badge-pulse" />
                {alerts.demandes_en_attente} demande{alerts.demandes_en_attente > 1 ? "s" : ""}
              </Link>
            )}
            {alerts.retards_critiques > 0 && (
              <Link
                to="/retards"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                <AlertTriangle size={13} />
                {alerts.retards_critiques} retard{alerts.retards_critiques > 1 ? "s" : ""}
              </Link>
            )}

            {/* Avatar top right */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center ml-1">
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-700 font-bold text-xs uppercase">
                  {user?.nom?.substring(0, 2) || "ST"}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6 bg-gray-50">
          <div key={location.pathname} className="max-w-7xl mx-auto page-transition">{children}</div>
        </main>
      </div>
    </div>
  );
}
