import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertTriangle, Lock, Mail, Smartphone, ShieldCheck } from "lucide-react";
import { useAuth, MOBILE_APP_URL } from "../../context/AuthContext";
import { showToast } from "../../components/common/Toast";
import DarkModeToggle from "../../components/common/DarkModeToggle";
import api, { IS_DESKTOP } from "../../services/api";

// Connexion à l'espace d'administration (personnel uniquement)
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get("expired") ? "Votre session a expiré. Veuillez vous reconnecter." : ""
  );
  const [notStaff, setNotStaff] = useState(false);
  const [sso, setSso] = useState({ enabled: false });

  const { login, loading } = useAuth();
  const navigate = useNavigate();

  // Le bouton Microsoft 365 n'apparaît que si le SSO est configuré côté serveur
  useEffect(() => {
    // Microsoft 365 ne peut pas rediriger vers l'application de bureau : bouton masqué dans l'appli Windows
    if (IS_DESKTOP) return;
    api.getSsoConfig().then(setSso).catch(() => setSso({ enabled: false }));
  }, []);

  const startMicrosoftLogin = () => {
    setError("");
    const nonce = crypto.getRandomValues(new Uint32Array(4)).join("-");
    sessionStorage.setItem("sso_nonce", nonce);
    const params = new URLSearchParams({
      client_id: sso.client_id,
      response_type: "id_token",
      redirect_uri: `${window.location.origin}/sso-callback`,
      scope: "openid profile email",
      response_mode: "fragment",
      nonce,
    });
    window.location.href = `https://login.microsoftonline.com/${sso.tenant_id || "common"}/oauth2/v2.0/authorize?${params}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotStaff(false);
    try {
      const loggedUser = await login(email.trim(), password);
      showToast(`Bienvenue, ${loggedUser.prenom || loggedUser.nom} !`, "success");
      navigate("/");
    } catch (err) {
      setNotStaff(!!err.notStaff);
      setError(err.message || "Identifiants invalides.");
    }
  };

  const input =
    "w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/20 focus:border-sky-brand focus:bg-white/10 text-white placeholder-gray-400 text-sm outline-none transition-all";

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between font-body relative bg-navy-950"
      style={{ backgroundImage: "url('/bg-login.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-[4px]" />

      <div className="relative z-10 p-6 flex items-center justify-end max-w-6xl mx-auto w-full">
        <DarkModeToggle className="bg-white/10 border-white/20 text-white" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto p-4 my-auto">
        <div className="bg-navy-900/90 border border-white/15 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl space-y-6 text-white animate-scale-in">
          <div className="flex flex-col items-center text-center space-y-2">
            <img src="/logo-iua.png" alt="IUA" className="h-14 w-14 object-contain rounded-2xl bg-white p-2 shadow-lg mb-2" />
            <h1 className="font-display text-2xl font-bold tracking-wide">PMB IUA — Administration</h1>
            <p className="text-xs text-sky-brand font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} /> Espace du personnel
            </p>
            <p className="text-xs text-gray-300">Bibliothécaires et administrateurs de la bibliothèque</p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {notStaff && (
                <a
                  href={MOBILE_APP_URL}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white text-navy-900 font-bold"
                >
                  <Smartphone size={14} /> Ouvrir l'application lecteur
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-300">Email professionnel</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@iua.ci"
                  required
                  className={input}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-300">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold text-sm transition-all shadow-lg hover:shadow-glow active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Connexion en cours..." : (<><LogIn size={16} /> Se connecter</>)}
            </button>

            {sso.enabled && (
              <>
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">ou</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  type="button"
                  onClick={startMicrosoftLogin}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-white text-navy-900 font-bold text-sm transition-all shadow-md flex items-center justify-center gap-3 hover:bg-gray-50"
                >
                  <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Se connecter avec Microsoft 365
                </button>
              </>
            )}
          </form>

          <p className="text-center text-[11px] text-gray-400">
            Vous êtes étudiant ou lecteur ?{" "}
            <a href={MOBILE_APP_URL} className="text-sky-300 font-semibold hover:underline">
              Utilisez l'application mobile
            </a>
          </p>
        </div>
      </div>

      <div className="relative z-10 text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Institut Universitaire d'Abidjan • Service des Bibliothèques
      </div>
    </div>
  );
}
