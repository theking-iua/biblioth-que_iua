import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCcw, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../components/common/Toast";

export default function SsoCallbackPage() {
  const [status, setStatus] = useState("Traitement de l'authentification Microsoft 365...");
  const [error, setError] = useState(null);
  const { loginSSO } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function handleSsoCallback() {
      try {
        // Microsoft renvoie l'id_token dans le fragment d'URL ; c'est le serveur qui le vérifie
        const params = new URLSearchParams(window.location.hash.substring(1));
        if (params.get("error")) {
          throw new Error(params.get("error_description") || "Connexion Microsoft annulée.");
        }
        const idToken = params.get("id_token");
        const nonce = sessionStorage.getItem("sso_nonce");
        sessionStorage.removeItem("sso_nonce");
        if (!idToken || !nonce) {
          throw new Error("Réponse Microsoft invalide. Relancez la connexion depuis la page de connexion.");
        }
        // Ne pas laisser le jeton dans la barre d'adresse / l'historique
        window.history.replaceState(null, "", window.location.pathname);

        setStatus("Vérification de votre identité Microsoft 365...");
        const loggedUser = await loginSSO(idToken, nonce);
        showToast(`Connexion Microsoft 365 réussie ! Bienvenue, ${loggedUser.nom}`, "success");

        navigate("/");
      } catch (err) {
        setError(err.message || "Impossible de compléter l'authentification Microsoft 365.");
      }
    }

    handleSsoCallback();
  }, [loginSSO, navigate]);

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-6 text-white font-body">
      <div className="bg-navy-900 border border-white/15 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-white p-3 mx-auto shadow-lg flex items-center justify-center">
          <img src="/logo-iua.png" alt="IUA Logo" className="w-full h-full object-contain" />
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-lg font-bold text-rose-300">Échec de Connexion SSO</h2>
            <p className="text-xs text-gray-300">{error}</p>
            <button
              onClick={() => navigate("/connexion")}
              className="mt-4 px-6 py-2.5 bg-sky-brand hover:bg-sky-deep text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-sky-500/20 text-sky-brand border border-sky-500/30 flex items-center justify-center mx-auto">
              <RefreshCcw size={24} className="animate-spin text-sky-brand" />
            </div>
            <h2 className="text-lg font-bold text-white">Authentification Microsoft 365</h2>
            <p className="text-xs text-sky-200">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
