import React from "react";
import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { Home, Search, GraduationCap, BookMarked, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { to: "/", label: "Accueil", icon: Home, end: true },
  { to: "/catalogue", label: "Catalogue", icon: Search },
  { to: "/memoires", label: "Mémoires", icon: GraduationCap },
  { to: "/prets", label: "Mes prêts", icon: BookMarked },
  { to: "/profil", label: "Profil", icon: User },
];

// Cadre de l'appli : contenu + barre d'onglets en bas (sur ordinateur, l'appli reste à largeur de téléphone)
export default function AppShell() {
  const { unread } = useAuth();
  return (
    <div className="min-h-full max-w-[480px] mx-auto bg-paper relative sm:border-x sm:border-line">
      <main className="pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface/95 backdrop-blur border-t border-line" aria-label="Navigation principale">
        <ul className="max-w-[480px] mx-auto grid grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium ${isActive ? "text-brand" : "text-muted"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
                    {label}
                    {to === "/profil" && unread > 0 && (
                      <span className="absolute top-1.5 left-1/2 ml-2 min-w-[16px] h-4 px-1 rounded-full bg-late text-white text-[10px] font-bold grid place-items-center tabular-nums">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Écran réservé aux lecteurs connectés. */
export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname)}`} replace />;
  return children;
}

/** Cadre sans barre d'onglets (connexion, inscription, carte…). */
export function BareShell({ children }) {
  return <div className="min-h-full max-w-[480px] mx-auto bg-paper sm:border-x sm:border-line">{children}</div>;
}
