import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ScreenHeader, Spinner, toast } from "../components/ui";
import { Field, PasswordInput } from "./AccountForms";

// Seules les adresses internes de l'appli sont acceptées comme destination après connexion
const safeNext = (s) => (s && s.startsWith("/") && !s.startsWith("//") ? s : "/");

function Brand({ title, text }) {
  return (
    <div className="px-5 pt-2 pb-6">
      <img src="/logo-iua.png" alt="" className="w-14 h-14 rounded-2xl bg-white p-1.5 border border-line" />
      <h1 className="mt-5 text-[26px] font-bold leading-tight">{title}</h1>
      <p className="mt-1 text-muted">{text}</p>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("expired") ? "Votre session a expiré. Reconnectez-vous." : "");
  const [sso, setSso] = useState({ enabled: false });

  useEffect(() => {
    api.getSsoConfig().then(setSso).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      toast(`Bienvenue, ${u.prenom || u.nom}`);
      navigate(safeNext(params.get("suite")), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const microsoft = () => {
    const nonce = crypto.getRandomValues(new Uint32Array(4)).join("-");
    sessionStorage.setItem("sso_nonce", nonce);
    sessionStorage.setItem("sso_next", safeNext(params.get("suite")));
    const q = new URLSearchParams({
      client_id: sso.client_id,
      response_type: "id_token",
      redirect_uri: `${window.location.origin}/sso-callback`,
      scope: "openid profile email",
      response_mode: "fragment",
      nonce,
    });
    window.location.href = `https://login.microsoftonline.com/${sso.tenant_id || "common"}/oauth2/v2.0/authorize?${q}`;
  };

  return (
    <div>
      <ScreenHeader title="" />
      <Brand title="Connexion" text="Avec votre email IUA ou votre matricule." />
      <form onSubmit={submit} className="px-5 space-y-4">
        {error && (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-late/10 text-late text-sm" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        <Field label="Email ou matricule">
          <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" inputMode="email" required placeholder="prenom.nom@iua.ci" />
        </Field>
        <Field label="Mot de passe" hint="Compte créé par la bibliothèque : le mot de passe initial est votre matricule.">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button disabled={loading} className="btn-primary w-full py-3.5">{loading ? "Connexion…" : "Se connecter"}</button>

        {sso.enabled && (
          <button type="button" onClick={microsoft} className="btn w-full py-3.5 bg-surface border border-line text-ink">
            <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Continuer avec Microsoft 365
          </button>
        )}
      </form>
      <p className="px-5 py-8 text-center text-sm text-muted">
        Pas encore de compte ? <Link to="/inscription" className="font-semibold text-brand">Créer un compte</Link>
      </p>
    </div>
  );
}

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ prenom: "", nom: "", email: "", telephone: "", filiere: "", matricule: "", mot_de_passe: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (f.mot_de_passe.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.");
    setLoading(true);
    try {
      await register(f);
      await login(f.email.trim(), f.mot_de_passe);
      toast("Compte créé. Bienvenue à la bibliothèque !");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ScreenHeader title="" />
      <Brand title="Créer un compte" text="Gratuit pour les étudiants et le personnel de l'IUA." />
      <form onSubmit={submit} className="px-5 pb-6 space-y-4">
        {error && (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-late/10 text-late text-sm" role="alert">
            <AlertCircle size={18} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className="field" value={f.prenom} onChange={set("prenom")} autoComplete="given-name" /></Field>
          <Field label="Nom"><input className="field" value={f.nom} onChange={set("nom")} required autoComplete="family-name" /></Field>
        </div>
        <Field label="Email"><input className="field" type="email" value={f.email} onChange={set("email")} required autoComplete="email" autoCapitalize="none" /></Field>
        <Field label="Matricule" hint="Facultatif. Laissez vide si vous n'en avez pas : un numéro vous sera attribué.">
          <input className="field" value={f.matricule} onChange={set("matricule")} autoCapitalize="characters" />
        </Field>
        <Field label="Filière"><input className="field" value={f.filiere} onChange={set("filiere")} placeholder="Ex. Master 1 Finance" /></Field>
        <Field label="Téléphone"><input className="field" type="tel" value={f.telephone} onChange={set("telephone")} autoComplete="tel" /></Field>
        <Field label="Mot de passe" hint="6 caractères minimum.">
          <PasswordInput value={f.mot_de_passe} onChange={set("mot_de_passe")} autoComplete="new-password" required />
        </Field>
        <button disabled={loading} className="btn-primary w-full py-3.5">{loading ? "Création…" : "Créer mon compte"}</button>
        <p className="text-center text-sm text-muted pt-2">
          Déjà inscrit ? <Link to="/connexion" className="font-semibold text-brand">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}

export function SsoCallbackPage() {
  const { loginSSO } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams(window.location.hash.slice(1));
        if (p.get("error")) throw new Error(p.get("error_description") || "Connexion Microsoft annulée.");
        const idToken = p.get("id_token");
        const nonce = sessionStorage.getItem("sso_nonce");
        const next = safeNext(sessionStorage.getItem("sso_next"));
        sessionStorage.removeItem("sso_nonce");
        sessionStorage.removeItem("sso_next");
        if (!idToken || !nonce) throw new Error("Réponse Microsoft invalide. Relancez la connexion.");
        window.history.replaceState(null, "", window.location.pathname);
        const u = await loginSSO(idToken, nonce);
        toast(`Bienvenue, ${u.prenom || u.nom}`);
        navigate(next, { replace: true });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[70vh] grid place-items-center px-6 text-center">
      {error ? (
        <div>
          <p className="font-semibold text-late">Connexion Microsoft impossible</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <Link to="/connexion" className="btn-primary mt-5">Retour à la connexion</Link>
        </div>
      ) : (
        <div>
          <Spinner className="mx-auto" />
          <p className="mt-4 text-muted">Vérification de votre compte Microsoft…</p>
        </div>
      )}
    </div>
  );
}
