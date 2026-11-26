import React, { useEffect, useState } from "react";
import { Settings, Save, ShieldAlert, CheckCircle2, Sliders, Bell, PlayCircle } from "lucide-react";
import { showToast } from "../../components/common/Toast";
import api from "../../services/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    duree_pret_jours: 14,
    max_emprunts_simultanes: 3,
    max_renouvellements: 2,
    jours_prolongation: 7,
    delai_recuperation_reservation_heures: 48,
    jours_retard_suspension: 10,
    nom_bibliotheque: "",
    email_contact: "",
    alerte_retard_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Charger les paramètres réels depuis la base
  useEffect(() => {
    api
      .getSettings()
      .then((s) =>
        setSettings((prev) => {
          const next = { ...prev };
          Object.entries(s).forEach(([k, v]) => {
            next[k] = k === "alerte_retard_active" ? v === "1" : isNaN(Number(v)) || k === "email_contact" || k === "nom_bibliotheque" ? v : Number(v);
          });
          return next;
        })
      )
      .catch((e) => showToast(e.message, "error"));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(settings);
      showToast("Paramètres enregistrés : ils s'appliquent immédiatement aux prêts et réservations.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRunDaily = async () => {
    setRunning(true);
    try {
      const res = await api.runDailyProcessing();
      showToast(res.message, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
          Paramètres du SIGB PMB IUA
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configuration des règles de circulation, quotas d'emprunt et délais de réservation.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Loan Rules Card */}
        <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-6">
          <h3 className="font-display text-base font-bold text-navy-800 dark:text-white flex items-center gap-2">
            <Sliders size={18} className="text-sky-brand" /> Règles de Prêt & Renouvellement
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Durée standard d'un emprunt (jours)
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.duree_pret_jours}
                onChange={(e) => setSettings({ ...settings, duree_pret_jours: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Délai standard accordé aux adhérents.</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Quota maximal d'emprunts simultanés
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_emprunts_simultanes}
                onChange={(e) => setSettings({ ...settings, max_emprunts_simultanes: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Nombre maximum d'ouvrages par lecteur.</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Nombre maximum de prolongations
              </label>
              <input
                type="number"
                min="0"
                max="5"
                value={settings.max_renouvellements}
                onChange={(e) => setSettings({ ...settings, max_renouvellements: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Prolongations consécutives autorisées.</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Jours ajoutés par prolongation
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.jours_prolongation}
                onChange={(e) => setSettings({ ...settings, jours_prolongation: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Délai additionnel accordé par renouvellement.</span>
            </div>
          </div>
        </div>

        {/* Reservation Rules Card */}
        <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-6">
          <h3 className="font-display text-base font-bold text-navy-800 dark:text-white flex items-center gap-2">
            <Bell size={18} className="text-sky-brand" /> Règles de Réservation & Notifications
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Délai de récupération d'une réservation (heures)
              </label>
              <input
                type="number"
                min="12"
                max="168"
                value={settings.delai_recuperation_reservation_heures}
                onChange={(e) => setSettings({ ...settings, delai_recuperation_reservation_heures: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Temps accordé pour retirer le livre disponible.</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Email de contact officiel
              </label>
              <input
                type="email"
                value={settings.email_contact}
                onChange={(e) => setSettings({ ...settings, email_contact: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Suspension automatique après (jours de retard)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings.jours_retard_suspension}
                onChange={(e) => setSettings({ ...settings, jours_retard_suspension: Number(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-bold"
              />
              <span className="text-[11px] text-gray-400">Le compte est réactivé automatiquement au retour des documents.</span>
            </div>

            <div>
              <label className="block font-semibold mb-1 text-gray-700 dark:text-gray-300">
                Nom de la bibliothèque
              </label>
              <input
                type="text"
                value={settings.nom_bibliotheque}
                onChange={(e) => setSettings({ ...settings, nom_bibliotheque: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 font-semibold"
              />
            </div>

            <label className="flex items-center gap-3 sm:col-span-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.alerte_retard_active}
                onChange={(e) => setSettings({ ...settings, alerte_retard_active: e.target.checked })}
                className="h-4 w-4 accent-sky-600"
              />
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Envoyer automatiquement une notification de retard aux lecteurs
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
          <button
            type="button"
            onClick={handleRunDaily}
            disabled={running}
            title="Passe les prêts échus en retard, suspend les retardataires et expire les réservations non retirées"
            className="px-6 py-3 rounded-xl border border-gray-300 dark:border-navy-600 text-navy-800 dark:text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <PlayCircle size={16} /> {running ? "Traitement..." : "Lancer le traitement des retards"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save size={16} /> {saving ? "Enregistrement..." : "Enregistrer la configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}
