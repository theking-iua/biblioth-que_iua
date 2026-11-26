import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ScreenHeader, toast } from "../components/ui";

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function PasswordInput({ value, onChange, autoComplete = "current-password", ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} className="field pr-12" {...rest} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center text-muted" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function EditProfilePage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nom: user.nom || "", prenom: user.prenom || "", email: user.email || "", telephone: user.telephone || "", filiere: user.filiere || "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateMember({ id: user.id, ...f });
      updateUser(f);
      toast("Informations enregistrées");
      navigate("/profil");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Mes informations" />
      <form onSubmit={submit} className="px-4 pb-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="field" value={f.prenom} onChange={set("prenom")} autoComplete="given-name" /></Field>
          <Field label="Nom"><input className="field" value={f.nom} onChange={set("nom")} required autoComplete="family-name" /></Field>
        </div>
        <Field label="Email"><input className="field" type="email" value={f.email} onChange={set("email")} required autoComplete="email" /></Field>
        <Field label="Téléphone"><input className="field" type="tel" value={f.telephone} onChange={set("telephone")} autoComplete="tel" placeholder="+225 07 00 00 00 00" /></Field>
        <Field label="Filière"><input className="field" value={f.filiere} onChange={set("filiere")} placeholder="Ex. Licence 3 Droit privé" /></Field>
        <Field label="Matricule" hint="Le matricule est modifiable uniquement par la bibliothèque.">
          <input className="field opacity-60" value={user.matricule || ""} disabled />
        </Field>
        <button disabled={saving} className="btn-primary w-full">{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </form>
    </div>
  );
}

export function PasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ old: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (f.next.length < 6) return toast("Le nouveau mot de passe doit contenir au moins 6 caractères.", "error");
    if (f.next !== f.confirm) return toast("Les deux nouveaux mots de passe ne sont pas identiques.", "error");
    setSaving(true);
    try {
      await api.updateMember({ id: user.id, nom: user.nom, email: user.email, mot_de_passe: f.next, ancien_mot_de_passe: f.old });
      toast("Mot de passe changé");
      navigate("/profil");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="Mot de passe" />
      <form onSubmit={submit} className="px-4 pb-8 space-y-4">
        <Field label="Mot de passe actuel" hint="Compte importé par la bibliothèque : votre mot de passe initial est votre matricule.">
          <PasswordInput value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} required />
        </Field>
        <Field label="Nouveau mot de passe" hint="6 caractères minimum.">
          <PasswordInput value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} autoComplete="new-password" required />
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <PasswordInput value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} autoComplete="new-password" required />
        </Field>
        <button disabled={saving} className="btn-primary w-full">{saving ? "Enregistrement…" : "Changer le mot de passe"}</button>
      </form>
    </div>
  );
}
