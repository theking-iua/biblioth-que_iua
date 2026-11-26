import React, { useState, useEffect } from "react";
import { Inbox, CheckCircle2, XCircle, Search, Clock, User, BookOpen, AlertCircle } from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { showToast } from "../../components/common/Toast";

export default function LoanRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState("en_attente"); // 'all', 'en_attente', 'validee', 'refusee'
  const [rejectModal, setRejectModal] = useState(null); // request object
  const [rejectReason, setRejectReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getBorrowRequests();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur de chargement des demandes", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reqId) => {
    setSubmittingAction(true);
    try {
      await api.approveBorrowRequest(reqId, user.id);
      showToast("Demande validée avec succès ! L'emprunt a été enregistré.", "success");
      loadRequests();
    } catch (err) {
      showToast(err.message || "Erreur lors de la validation", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectModal) return;
    setSubmittingAction(true);
    try {
      await api.rejectBorrowRequest(rejectModal.id, user.id, rejectReason);
      showToast("Demande d'emprunt refusée.", "info");
      setRejectModal(null);
      setRejectReason("");
      loadRequests();
    } catch (err) {
      showToast(err.message || "Erreur lors du refus", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const filtered = requests.filter((r) => {
    if (filterStatut === "all") return true;
    return r.statut === filterStatut;
  });

  const pendingCount = requests.filter((r) => r.statut === "en_attente").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
          Demandes d'Emprunt en Ligne
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Validez ou rejetez les demandes de prêt formulées à distance par les lecteurs et étudiants.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {[
          { id: "en_attente", label: "En attente de validation", count: pendingCount, alert: pendingCount > 0 },
          { id: "validee", label: "Demandes validées", count: requests.filter((r) => r.statut === "validee").length },
          { id: "refusee", label: "Demandes refusées", count: requests.filter((r) => r.statut === "refusee").length },
          { id: "all", label: "Toutes les demandes", count: requests.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatut(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              filterStatut === tab.id
                ? "bg-navy-800 dark:bg-sky-brand text-white shadow-sm"
                : tab.alert
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200"
                : "bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-navy-700"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/20">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Demandeur</th>
                <th className="px-6 py-4">Ouvrage Sollicité</th>
                <th className="px-6 py-4">Date de demande</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">
                      {req.user_nom} {req.user_prenom || ""}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {req.user_email} • Matricule : {req.user_matricule || "—"}
                    </p>
                    <p className="text-[10px] text-sky-brand font-medium">{req.user_filiere}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-navy-800 dark:text-white">{req.titre}</p>
                    <p className="text-[11px] text-gray-400">
                      {req.auteur} • Cote : <strong className="font-mono text-navy-800 dark:text-white">{req.cote || "ROM"}</strong>
                    </p>
                    {req.motif_refus && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">
                        Motif refus : {req.motif_refus}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(req.date_demande).toLocaleDateString("fr-FR")} à{" "}
                    {new Date(req.date_demande).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={req.statut} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {req.statut === "en_attente" ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={submittingAction}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1"
                        >
                          <CheckCircle2 size={14} /> Valider
                        </button>
                        <button
                          onClick={() => setRejectModal(req)}
                          disabled={submittingAction}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition-all flex items-center gap-1"
                        >
                          <XCircle size={14} /> Refuser
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Traité</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucune demande dans cette catégorie.
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-md w-full p-6 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4">
            <h3 className="font-display text-lg font-bold text-navy-800 dark:text-white">
              Refuser la demande d'emprunt
            </h3>
            <p className="text-xs text-gray-500">
              Précisez le motif du refus pour en informer l'adhérent <strong>{rejectModal.user_nom}</strong>.
            </p>

            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Motif de refus</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  required
                >
                  <option value="">-- Choisir un motif standard --</option>
                  <option value="Exemplaire actuellement en consultation sur place uniquement">Exemplaire en consultation sur place uniquement</option>
                  <option value="Quota d'emprunt maximal atteint par l'adhérent">Quota d'emprunt maximal atteint par l'adhérent</option>
                  <option value="Compte adhérent temporairement suspendu (retard non régularisé)">Compte suspendu (retards non régularisés)</option>
                  <option value="Exemplaire en restauration ou inventaire">Exemplaire en restauration ou inventaire</option>
                  <option value="Autre motif académique">Autre motif académique</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 rounded-xl text-gray-500 bg-gray-100 dark:bg-navy-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Confirmer le refus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
