import React, { useState, useEffect } from "react";
import { AlertTriangle, Bell, Mail, Phone, RotateCcw, CheckCircle2, Search, UserX, ShieldAlert } from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { showToast } from "../../components/common/Toast";

export default function DelaysTrackerPage() {
  const [delayedLoans, setDelayedLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDelays();
  }, []);

  const loadDelays = async () => {
    setLoading(true);
    try {
      const data = await api.getLoans();
      if (Array.isArray(data)) {
        // Filtrer les emprunts en retard
        const now = new Date();
        const late = data.filter((l) => {
          return (
            l.statut === "en_retard" ||
            (l.statut === "en_cours" && new Date(l.date_retour_prevue) < now)
          );
        });
        setDelayedLoans(late);
      }
    } catch (e) {
      showToast("Erreur lors de la récupération des retards", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (loan) => {
    try {
      // Envoyer une notification directe à l'adhérent
      await api.sendNotification({
        user_id: loan.user_id,
        titre: `Relance : Retard sur "${loan.titre}"`,
        message: `Votre prêt pour l'ouvrage "${loan.titre}" est en retard de ${loan.jours_retard} jour(s). Veuillez le restituer sans délai à l'accueil de la bibliothèque.`,
        type: "retard",
      });
      showToast(`Rappel de retard envoyé à ${loan.user_name}`, "success");
    } catch (e) {
      showToast("Erreur lors de l'envoi du rappel", "error");
    }
  };

  const handleToggleBlockUser = async (loan) => {
    const isSuspended = loan.user_statut === "suspendu";
    const actionText = isSuspended ? "débloquer" : "bloquer/suspendre";
    if (!confirm(`Voulez-vous vraiment ${actionText} le compte de ${loan.user_name} ?`)) return;

    try {
      await api.updateMember({
        id: loan.user_id,
        statut: isSuspended ? "actif" : "suspendu",
      });
      showToast(
        isSuspended
          ? `Compte de ${loan.user_name} débloqué avec succès.`
          : `Compte de ${loan.user_name} suspendu avec succès !`,
        isSuspended ? "success" : "info"
      );
      loadDelays();
    } catch (e) {
      showToast("Erreur lors de la modification du statut du compte", "error");
    }
  };

  const handleReturn = async (loanId) => {
    if (!confirm("Confirmer la restitution du document ?")) return;
    try {
      await api.returnLoan(loanId);
      showToast("Document restitué et remis en rayon.", "success");
      loadDelays();
    } catch (e) {
      showToast("Erreur lors du retour", "error");
    }
  };

  const filtered = delayedLoans.filter((l) => {
    return (
      (l.titre + " " + l.auteur + " " + (l.user_name || "") + " " + (l.user_email || ""))
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">
          <AlertTriangle size={16} /> Suivi Automatique des Retards
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
          Gestion des Retards ({delayedLoans.length})
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Surveillance des emprunts non restitués après échéance et envoi d'alertes aux adhérents.
        </p>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-3xl p-6">
          <p className="text-xs font-bold uppercase text-rose-600">Total Retards Actifs</p>
          <p className="font-display text-3xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {delayedLoans.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ouvrages hors délais</p>
        </div>

        <div className="bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-3xl p-6">
          <p className="text-xs font-bold uppercase text-gray-400">Plus Ancien Retard</p>
          <p className="font-display text-2xl font-bold text-navy-800 dark:text-white mt-1">
            {delayedLoans.length > 0 ? `${Math.max(...delayedLoans.map((l) => l.jours_retard || 1))} jours` : "0 jour"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Nécessite relance téléphonique</p>
        </div>

        <div className="bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-3xl p-6">
          <p className="text-xs font-bold uppercase text-gray-400">Taux de Ponctualité</p>
          <p className="font-display text-2xl font-bold text-emerald-600 mt-1">
            92.4 %
          </p>
          <p className="text-xs text-gray-500 mt-1">Restitutions conformes IUA</p>
        </div>
      </div>

      {/* Delays Table */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <h3 className="font-display font-bold text-base text-navy-800 dark:text-white">
            Liste des Prêts en Retard
          </h3>
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher adhérent ou livre..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-xs text-navy-800 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Nom de l'adhérent</th>
                <th className="px-6 py-4">Document / Titre</th>
                <th className="px-6 py-4">Date de prêt</th>
                <th className="px-6 py-4">Date prévue</th>
                <th className="px-6 py-4">Nombre de jours</th>
                <th className="px-6 py-4 text-right">Actions rapides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-navy-800 dark:text-white text-sm">{l.user_name}</p>
                      {l.user_statut === "suspendu" && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-rose-500/20 text-rose-600 border border-rose-500/40">
                          Compte Bloqué
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Mail size={12} /> {l.user_email}
                    </p>
                    {l.user_telephone && (
                      <p className="text-[11px] text-sky-deep dark:text-sky-brand flex items-center gap-1">
                        <Phone size={12} /> {l.user_telephone}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-navy-800 dark:text-white">{l.titre}</p>
                    <p className="text-[11px] text-gray-400">Cote : {l.cote || "ROM-01"}</p>
                  </td>
                  <td className="px-6 py-4">
                    {new Date(l.date_emprunt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 font-bold text-rose-600">
                    {new Date(l.date_retour_prevue).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                      <AlertTriangle size={12} /> {l.jours_retard || 1} jour(s) de retard
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSendReminder(l)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-sky-deep bg-sky-pale hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-brand flex items-center gap-1 transition-all"
                        title="Envoyer une notification de rappel"
                      >
                        <Bell size={13} /> Relancer
                      </button>

                      {/* Bouton pour bloquer ou débloquer le compte de l'adhérent */}
                      <button
                        onClick={() => handleToggleBlockUser(l)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-sm ${
                          l.user_statut === "suspendu"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-rose-600 hover:bg-rose-700 text-white"
                        }`}
                        title={l.user_statut === "suspendu" ? "Débloquer le compte de cet adhérent" : "Bloquer / Suspendre le compte de cet adhérent"}
                      >
                        <UserX size={13} /> {l.user_statut === "suspendu" ? "Débloquer" : "Bloquer le compte"}
                      </button>

                      <button
                        onClick={() => handleReturn(l.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-navy-700 dark:text-gray-200 flex items-center gap-1 transition-all"
                        title="Marquer comme retourné"
                      >
                        <RotateCcw size={13} /> Restituer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              {delayedLoans.length === 0
                ? "Excellent ! Aucun emprunt n'est actuellement en retard."
                : "Aucun résultat pour cette recherche."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
