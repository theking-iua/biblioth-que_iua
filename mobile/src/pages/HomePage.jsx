import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, ChevronRight, GraduationCap } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import BookCover from "../components/BookCover";
import { daysUntil, dueLabel } from "../lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
}

// Compte à rebours d'un prêt : le chiffre est l'information principale
function DueBadge({ date }) {
  const n = daysUntil(date);
  const tone = n < 0 ? "bg-late text-white" : n <= 3 ? "bg-ochre text-white" : "bg-ink/5 text-ink";
  return (
    <div className={`w-14 shrink-0 rounded-xl ${tone} grid place-items-center py-2`}>
      <span className="font-display text-2xl font-bold leading-none tabular-nums">{Math.abs(n)}</span>
      <span className="text-[10px] font-semibold mt-0.5">{n < 0 ? "j retard" : n === 0 ? "auj." : "jours"}</span>
    </div>
  );
}

export default function HomePage() {
  const { user, isAuthenticated, unread } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState(null);
  const [loans, setLoans] = useState([]);
  const [pickup, setPickup] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getDocuments().then((d) => setRecent(d.slice(0, 10))).catch(() => setRecent([]));
    api.getDashboardStats().then(setStats).catch(() => {});
    api.getTaxonomies("categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.getLoans().then((l) => setLoans(l.filter((x) => x.statut !== "retourne"))).catch(() => {});
    api.getReservations().then((r) => setPickup(r.filter((x) => x.statut === "disponible"))).catch(() => {});
  }, [isAuthenticated]);

  const submit = (e) => {
    e.preventDefault();
    navigate(`/catalogue${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  return (
    <div>
      {/* En-tête bleu IUA */}
      <section className="bg-brand dark:bg-[#1B3C8C] text-white pt-safe rounded-b-[28px]">
        <div className="px-5 pt-4 pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo-iua.png" alt="" className="w-9 h-9 rounded-xl bg-white p-1" />
              <span className="font-display font-semibold text-[15px]">Bibliothèque IUA</span>
            </div>
            {isAuthenticated && (
              <Link to="/notifications" className="relative w-10 h-10 grid place-items-center rounded-full bg-white/15" aria-label={`Notifications (${unread} non lues)`}>
                <Bell size={20} />
                {unread > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-ochre ring-2 ring-brand dark:ring-[#1B3C8C]" />}
              </Link>
            )}
          </div>

          <h1 className="mt-6 text-[28px] leading-[1.1] font-bold">
            {isAuthenticated ? `${greeting()}, ${user.prenom || user.nom}.` : "Que voulez-vous lire aujourd'hui ?"}
          </h1>
          {stats && (
            <p className="mt-1.5 text-white/80 text-sm">
              {stats.total_documents} ouvrages, {stats.copies_disponibles} exemplaires disponibles en rayon.
            </p>
          )}

          <form onSubmit={submit} className="mt-5 relative" role="search">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              enterKeyHint="search"
              placeholder="Titre, auteur, ISBN, mot-clé…"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-surface text-ink text-[15px] placeholder:text-muted outline-none"
              aria-label="Rechercher dans le catalogue"
            />
          </form>
        </div>
      </section>

      <div className="px-4">
        {/* À retirer à l'accueil */}
        {pickup.length > 0 && (
          <Link to="/prets?onglet=reservations" className="mt-5 flex items-center gap-3 p-4 rounded-2xl bg-ok/10 text-ok">
            <BookCover book={pickup[0]} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{pickup.length > 1 ? `${pickup.length} réservations vous attendent` : "Votre réservation vous attend"}</p>
              <p className="text-sm text-ink/80 truncate">{pickup[0].titre}, à retirer à l'accueil</p>
            </div>
            <ChevronRight size={20} />
          </Link>
        )}

        {/* Mes prêts en cours */}
        {isAuthenticated && loans.length > 0 && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-lg font-semibold">Mes prêts</h2>
              <Link to="/prets" className="text-sm font-semibold text-brand">Tout voir</Link>
            </div>
            <ul className="bg-surface rounded-2xl border border-line divide-y divide-line">
              {loans
                .slice()
                .sort((a, b) => a.date_retour_prevue.localeCompare(b.date_retour_prevue))
                .slice(0, 3)
                .map((l) => (
                  <li key={l.id}>
                    <Link to="/prets" className="flex items-center gap-3 p-3">
                      <DueBadge date={l.date_retour_prevue} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{l.titre}</p>
                        <p className={`text-sm ${daysUntil(l.date_retour_prevue) < 0 ? "text-late" : "text-muted"}`}>{dueLabel(l.date_retour_prevue)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Nouveautés */}
        <section className="mt-7">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">Arrivés récemment</h2>
            <Link to="/catalogue" className="text-sm font-semibold text-brand">Catalogue</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
            {(recent || Array.from({ length: 4 })).map((b, i) =>
              b ? (
                <Link key={b.id} to={`/livre/${b.id}`} className="w-24 shrink-0">
                  <BookCover book={b} size="md" />
                  <p className="mt-2 text-sm font-medium leading-snug line-clamp-2">{b.titre}</p>
                  <p className="text-xs text-muted truncate">{b.auteur}</p>
                </Link>
              ) : (
                <div key={i} className="w-24 h-36 shrink-0 rounded-lg bg-ink/5 animate-pulse" />
              )
            )}
          </div>
        </section>

        {/* Parcourir par domaine */}
        {categories.length > 0 && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold mb-2">Parcourir par domaine</h2>
            <ul className="bg-surface rounded-2xl border border-line divide-y divide-line">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to={`/catalogue?categorie=${encodeURIComponent(c.nom)}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <span className="text-[15px]">{c.nom}</span>
                    <ChevronRight size={18} className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Mémoires */}
        <Link to="/memoires" className="mt-6 mb-6 flex items-center gap-4 p-4 rounded-2xl bg-ink text-paper">
          <div className="w-12 h-12 rounded-xl bg-paper/10 grid place-items-center shrink-0">
            <GraduationCap size={24} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Mémoires et thèses de l'IUA</p>
            <p className="text-sm text-paper/70">
              {stats ? `${stats.total_memoires} travaux soutenus à lire en ligne` : "Travaux soutenus à lire en ligne"}
            </p>
          </div>
          <ChevronRight size={20} />
        </Link>

        {!isAuthenticated && (
          <div className="mb-8 p-5 rounded-2xl border border-line bg-surface">
            <p className="font-semibold">Empruntez depuis votre téléphone</p>
            <p className="text-sm text-muted mt-1">Connectez-vous pour demander un livre, réserver un exemplaire et suivre vos dates de retour.</p>
            <div className="flex gap-2 mt-4">
              <Link to="/connexion" className="btn-primary flex-1">Se connecter</Link>
              <Link to="/inscription" className="btn-quiet flex-1">Créer un compte</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
