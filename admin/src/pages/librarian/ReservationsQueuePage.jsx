import React, { useState, useEffect } from "react";
import { Layers, Bookmark, User, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { showToast } from "../../components/common/Toast";

export default function ReservationsQueuePage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await api.getReservations();
      setReservations(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur lors de la récupération des réservations", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Annuler cette réservation ?")) return;
    try {
      await api.cancelReservation(id);
      showToast("Réservation annulée avec succès", "info");
      loadReservations();
    } catch (e) {
      showToast("Erreur lors de l'annulation", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
          File d'Attente des Réservations
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gestion des priorités de retrait lorsque les exemplaires sont retournés par les emprunteurs.
        </p>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Rang File</th>
                <th className="px-6 py-4">Ouvrage Réservé</th>
                <th className="px-6 py-4">Adhérent Demandeur</th>
                <th className="px-6 py-4">Date de Réservation</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-navy-800 dark:text-white">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-sky-pale dark:bg-navy-700 text-sky-deep dark:text-sky-brand font-mono font-bold text-xs">
                      #{r.rang_file}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">{r.titre}</p>
                    <p className="text-[11px] text-gray-400">{r.auteur} • Cote : {r.cote || "ROM"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-navy-800 dark:text-white">{r.user_nom}</p>
                    <p className="text-[11px] text-gray-400">{r.user_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {new Date(r.date_reservation).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={r.statut} />
                    {r.statut === "disponible" && r.date_expiration && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">
                        Retrait avant le {new Date(r.date_expiration).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {r.statut === "en_attente" && (
                      <button
                        onClick={() => handleCancel(r.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold text-xs"
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {reservations.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucune réservation enregistrée.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
