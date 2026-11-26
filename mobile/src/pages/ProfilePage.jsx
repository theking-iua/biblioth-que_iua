import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Heart, UserCog, KeyRound, ScrollText, Moon, LogOut, ChevronRight, QrCode, Camera, ShieldCheck, LogIn } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Sheet, toast, Empty } from "../components/ui";
import { fullName, initials } from "../lib/format";

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:5173";

export function Avatar({ user, size = "w-16 h-16 text-xl" }) {
  return user?.photo ? (
    <img src={api.getPhotoUrl(user.photo)} alt="" className={`${size} rounded-2xl object-cover bg-line`} />
  ) : (
    <div className={`${size} rounded-2xl bg-brand text-white grid place-items-center font-display font-bold`}>{initials(user)}</div>
  );
}

function Item({ icon: Icon, label, to, onClick, right, danger }) {
  const cls = `w-full flex items-center gap-3.5 px-4 py-3.5 text-left ${danger ? "text-late" : ""}`;
  const inner = (
    <>
      <Icon size={20} className={danger ? "" : "text-muted"} />
      <span className="flex-1 text-[15px]">{label}</span>
      {right ?? (!danger && <ChevronRight size={18} className="text-muted" />)}
    </>
  );
  return <li>{to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>}</li>;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isStaff, unread, logout, updateUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [rules, setRules] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.getSettings().then(setRules).catch(() => {});
  }, []);

  const changePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast("La photo ne doit pas dépasser 3 Mo.", "error");
    setUploading(true);
    try {
      const out = await api.uploadPhoto(null, file);
      updateUser({ photo: out.photo });
      toast("Photo mise à jour");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const rulesSheet = (
    <Sheet open={showRules} onClose={() => setShowRules(false)} title="Règles de prêt">
      {rules && (
        <ul className="divide-y divide-line text-[15px]">
          <li className="py-3 flex justify-between gap-4"><span className="text-muted">Durée d'un prêt</span><span className="font-semibold">{rules.duree_pret_jours} jours</span></li>
          <li className="py-3 flex justify-between gap-4"><span className="text-muted">Documents en même temps</span><span className="font-semibold">{rules.max_emprunts_simultanes} maximum</span></li>
          <li className="py-3 flex justify-between gap-4"><span className="text-muted">Prolongations</span><span className="font-semibold">{rules.max_renouvellements} × {rules.jours_prolongation} jours</span></li>
          <li className="py-3 flex justify-between gap-4"><span className="text-muted">Retrait d'une réservation</span><span className="font-semibold">sous {rules.delai_recuperation_reservation_heures} h</span></li>
          <li className="py-3 flex justify-between gap-4"><span className="text-muted">Suspension du compte</span><span className="font-semibold text-right">après {rules.jours_retard_suspension} j de retard</span></li>
          <li className="py-3 text-sm text-muted">
            Un livre réservé par un autre lecteur ne peut pas être prolongé. Contact : <a className="text-brand font-semibold" href={`mailto:${rules.email_contact}`}>{rules.email_contact}</a>
          </li>
        </ul>
      )}
    </Sheet>
  );

  if (!isAuthenticated) {
    return (
      <div className="pt-safe">
        <h1 className="px-4 pt-4 text-2xl font-bold">Profil</h1>
        <Empty
          icon={LogIn}
          title="Vous n'êtes pas connecté"
          text="Connectez-vous avec votre email IUA ou votre matricule pour suivre vos prêts."
          action={
            <div className="flex flex-col gap-2 w-60 mx-auto">
              <Link to="/connexion" className="btn-primary">Se connecter</Link>
              <Link to="/inscription" className="btn-quiet">Créer un compte</Link>
            </div>
          }
        />
        <ul className="mx-4 bg-surface rounded-2xl border border-line divide-y divide-line">
          <Item icon={ScrollText} label="Règles de prêt" onClick={() => setShowRules(true)} />
          <Item icon={Moon} label="Thème sombre" onClick={toggleTheme} right={<Toggle on={isDark} />} />
        </ul>
        {rulesSheet}
      </div>
    );
  }

  return (
    <div className="pt-safe pb-6">
      <h1 className="px-4 pt-4 text-2xl font-bold">Profil</h1>

      <section className="px-4 mt-4 flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Changer la photo de profil">
          <Avatar user={user} />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-surface border border-line grid place-items-center">
            <Camera size={14} className={uploading ? "animate-pulse" : ""} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={changePhoto} />
        <div className="min-w-0">
          <p className="text-lg font-semibold truncate">{fullName(user)}</p>
          <p className="text-sm text-muted truncate">{user.filiere || user.email}</p>
          {user.statut === "suspendu" && <p className="text-sm font-semibold text-late mt-0.5">Compte suspendu</p>}
        </div>
      </section>

      <Link to="/carte" className="mx-4 mt-5 flex items-center gap-4 p-4 rounded-2xl bg-ink text-paper">
        <QrCode size={28} />
        <div className="flex-1">
          <p className="font-semibold">Ma carte de lecteur</p>
          <p className="text-sm text-paper/70 tabular-nums">{user.matricule || "Matricule non renseigné"}</p>
        </div>
        <ChevronRight size={20} />
      </Link>

      <ul className="mx-4 mt-5 bg-surface rounded-2xl border border-line divide-y divide-line">
        <Item
          icon={Bell}
          label="Notifications"
          to="/notifications"
          right={
            <span className="flex items-center gap-2">
              {unread > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-late text-white text-xs font-bold grid place-items-center tabular-nums">{unread}</span>}
              <ChevronRight size={18} className="text-muted" />
            </span>
          }
        />
        <Item icon={Heart} label="Mes favoris" to="/favoris" />
      </ul>

      <ul className="mx-4 mt-4 bg-surface rounded-2xl border border-line divide-y divide-line">
        <Item icon={UserCog} label="Modifier mes informations" to="/profil/modifier" />
        <Item icon={KeyRound} label="Changer de mot de passe" to="/profil/mot-de-passe" />
        <Item icon={ScrollText} label="Règles de prêt" onClick={() => setShowRules(true)} />
        <Item icon={Moon} label="Thème sombre" onClick={toggleTheme} right={<Toggle on={isDark} />} />
      </ul>

      {isStaff && (
        <ul className="mx-4 mt-4 bg-surface rounded-2xl border border-line">
          <li>
            <a href={ADMIN_URL} className="w-full flex items-center gap-3.5 px-4 py-3.5">
              <ShieldCheck size={20} className="text-brand" />
              <span className="flex-1 text-[15px]">Espace d'administration</span>
              <ChevronRight size={18} className="text-muted" />
            </a>
          </li>
        </ul>
      )}

      <ul className="mx-4 mt-4 bg-surface rounded-2xl border border-line">
        <Item
          icon={LogOut}
          label="Se déconnecter"
          danger
          onClick={() => {
            logout();
            toast("Vous êtes déconnecté", "info");
            navigate("/");
          }}
        />
      </ul>
      {rulesSheet}
    </div>
  );
}

function Toggle({ on }) {
  return (
    <span className={`w-11 h-6 rounded-full p-0.5 transition ${on ? "bg-brand" : "bg-line"}`} aria-hidden="true">
      <span className={`block w-5 h-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} />
    </span>
  );
}
