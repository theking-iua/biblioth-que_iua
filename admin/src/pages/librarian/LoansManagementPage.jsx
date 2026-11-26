import React, { useState, useEffect } from "react";
import {
  ScanLine,
  Search,
  Filter,
  Bookmark,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  User,
  BookOpen,
  Calendar,
} from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/common/StatusBadge";
import { showToast } from "../../components/common/Toast";

export default function LoansManagementPage() {
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("tous"); // 'tous', 'en_cours', 'retard', 'retourne'
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Loan Form State
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedDoc, setSelectedDoc] = useState("");
  const [loanDays, setLoanDays] = useState(14);
  const [submittingLoan, setSubmittingLoan] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lData, mData, dData] = await Promise.all([
        api.getLoans(),
        api.getMembers(),
        api.getDocuments(),
      ]);

      setLoans(Array.isArray(lData) ? lData : []);
      setMembers(Array.isArray(mData) ? mData : []);
      setAvailableDocs(
        Array.isArray(dData)
          ? dData.filter((d) => Number(d.disponible) === 1 || Number(d.copies_disponibles) > 0)
          : []
      );
    } catch (e) {
      showToast("Erreur de chargement des emprunts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    if (!selectedMember || !selectedDoc) {
      showToast("Veuillez sélectionner un adhérent et un document", "error");
      return;
    }

    setSubmittingLoan(true);
    try {
      await api.createLoan({
        user_id: Number(selectedMember),
        document_id: Number(selectedDoc),
        days: Number(loanDays),
      });
      showToast("Prêt enregistré avec succès !", "success");
      setSelectedDoc("");
      setSelectedMember("");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement du prêt", "error");
    } finally {
      setSubmittingLoan(false);
    }
  };

  // Comptoir code-barres
  const [scanLecteur, setScanLecteur] = useState("");
  const [scanPret, setScanPret] = useState("");
  const [scanRetour, setScanRetour] = useState("");
  const [scanBusy, setScanBusy] = useState(false);

  const handleBarcodeCheckout = async (e) => {
    e.preventDefault();
    if (!scanLecteur.trim() || !scanPret.trim()) {
      showToast("Saisissez le lecteur et le code-barres de l'exemplaire", "error");
      return;
    }
    setScanBusy(true);
    try {
      const res = await api.checkoutByBarcode(scanPret.trim(), scanLecteur.trim());
      showToast(`Prêt enregistré : « ${res.titre} » — retour le ${new Date(res.date_retour_prevue).toLocaleDateString("fr-FR")}`, "success");
      setScanPret("");
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setScanBusy(false);
    }
  };

  const handleBarcodeCheckin = async (e) => {
    e.preventDefault();
    if (!scanRetour.trim()) return;
    setScanBusy(true);
    try {
      const res = await api.checkinByBarcode(scanRetour.trim());
      let msg = `Retour enregistré : « ${res.titre} »`;
      if (res.jours_retard > 0) msg += ` (${res.jours_retard} j de retard)`;
      if (res.reserve_pour) msg += " — à mettre de côté : réservé par un lecteur";
      showToast(msg, res.reserve_pour ? "info" : "success");
      setScanRetour("");
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setScanBusy(false);
    }
  };

  const handleReturnLoan = async (loanId) => {
    if (!confirm("Confirmer le retour et la remise en rayon de ce document ?")) return;
    try {
      await api.returnLoan(loanId);
      showToast("Document retourné et remis en rayon avec succès !", "success");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors du retour", "error");
    }
  };

  // Filtered loans
  const filtered = loans.filter((l) => {
    const isLate = l.statut === "en_cours" && new Date(l.date_retour_prevue) < new Date();
    const matchesFilter =
      activeFilter === "tous" ||
      (activeFilter === "en_cours" && l.statut === "en_cours" && !isLate) ||
      (activeFilter === "retard" && (isLate || l.statut === "en_retard")) ||
      (activeFilter === "retourne" && l.statut === "retourne");

    const matchesSearch =
      !searchQuery ||
      (l.titre + " " + l.auteur + " " + (l.user_name || "") + " " + (l.user_email || "") + " " + (l.code_barre || ""))
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const counts = {
    tous: loans.length,
    en_cours: loans.filter((l) => l.statut === "en_cours" && new Date(l.date_retour_prevue) >= new Date()).length,
    retard: loans.filter((l) => l.statut === "en_retard" || (l.statut === "en_cours" && new Date(l.date_retour_prevue) < new Date())).length,
    retourne: loans.filter((l) => l.statut === "retourne").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
          Gestion des Prêts & Retours
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enregistrez les prêts rapides au guichet, validez les retours et suivez les échéances.
        </p>
      </div>

      {/* Comptoir de circulation par code-barres (compatible douchette : saisie + Entrée) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form
          onSubmit={handleBarcodeCheckout}
          className="bg-white dark:bg-navy-800 rounded-3xl p-6 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-3 text-xs"
        >
          <h2 className="font-display text-base font-bold text-navy-800 dark:text-white flex items-center gap-2">
            <ScanLine size={18} className="text-sky-brand" /> Prêt par code-barres
          </h2>
          <input
            value={scanLecteur}
            onChange={(e) => setScanLecteur(e.target.value)}
            placeholder="Matricule ou email du lecteur"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
          />
          <div className="flex gap-2">
            <input
              value={scanPret}
              onChange={(e) => setScanPret(e.target.value)}
              placeholder="Code-barres de l'exemplaire (ex. IUA-EX-0001-01)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
            />
            <button type="submit" disabled={scanBusy} className="px-4 py-2.5 rounded-xl bg-sky-brand text-white font-bold disabled:opacity-60">
              Prêter
            </button>
          </div>
        </form>

        <form
          onSubmit={handleBarcodeCheckin}
          className="bg-white dark:bg-navy-800 rounded-3xl p-6 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-3 text-xs"
        >
          <h2 className="font-display text-base font-bold text-navy-800 dark:text-white flex items-center gap-2">
            <RotateCcw size={18} className="text-emerald-500" /> Retour par code-barres
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Scannez l'exemplaire rendu : le prêt est clôturé, et le document est mis de côté si un lecteur l'a réservé.
          </p>
          <div className="flex gap-2">
            <input
              value={scanRetour}
              onChange={(e) => setScanRetour(e.target.value)}
              placeholder="Code-barres de l'exemplaire rendu"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
            />
            <button type="submit" disabled={scanBusy} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-60">
              Retour
            </button>
          </div>
        </form>
      </div>

      {/* Quick Loan Card (Prêt Rapide) */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl p-6 sm:p-8 border border-gray-200 dark:border-navy-700/80 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <ScanLine className="text-sky-brand" size={20} />
          <h2 className="font-display text-lg font-bold text-navy-800 dark:text-white">
            Enregistrer un Nouveau Prêt au Guichet
          </h2>
        </div>

        <form onSubmit={handleCreateLoan} className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          {/* Member select */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block font-semibold text-gray-700 dark:text-gray-300">
              Sélectionner l'adhérent
            </label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-navy-800 dark:text-white outline-none"
            >
              <option value="">-- Choisir un adhérent ({members.length}) --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom} {m.prenom || ""} ({m.matricule || m.email})
                </option>
              ))}
            </select>
          </div>

          {/* Document select */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="block font-semibold text-gray-700 dark:text-gray-300">
              Sélectionner l'ouvrage disponible
            </label>
            <select
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-navy-800 dark:text-white outline-none"
            >
              <option value="">-- Choisir un document disponible ({availableDocs.length}) --</option>
              {availableDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.titre} — {d.auteur} [{d.cote || "ROM"}]
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div className="md:col-span-1 space-y-1.5">
            <label className="block font-semibold text-gray-700 dark:text-gray-300">
              Durée (j)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={loanDays}
              onChange={(e) => setLoanDays(e.target.value)}
              className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-navy-800 dark:text-white outline-none text-center font-bold"
            />
          </div>

          {/* Submit button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={submittingLoan}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-sky-brand hover:bg-sky-deep text-white shadow-md transition-all active:scale-95"
            >
              {submittingLoan ? "Validation..." : "Valider le prêt"}
            </button>
          </div>
        </form>
      </div>

      {/* Loans Ledger */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        {/* Filters and search bar */}
        <div className="p-6 border-b border-gray-200 dark:border-navy-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {[
              { id: "tous", label: "Tous", count: counts.tous },
              { id: "en_cours", label: "En cours", count: counts.en_cours },
              { id: "retard", label: "En retard", count: counts.retard, alert: counts.retard > 0 },
              { id: "retourne", label: "Retournés", count: counts.retourne },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveFilter(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold transition-all ${
                  activeFilter === t.id
                    ? "bg-navy-800 dark:bg-sky-brand text-white shadow-sm"
                    : t.alert
                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                    : "bg-gray-100 dark:bg-navy-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/20">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par adhérent, livre, code..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-xs text-navy-800 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Adhérent</th>
                <th className="px-6 py-4">Document / Cote</th>
                <th className="px-6 py-4">Exemplaire</th>
                <th className="px-6 py-4">Date de prêt</th>
                <th className="px-6 py-4">Échéance</th>
                <th className="px-6 py-4">Statut / Retard</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((l) => {
                const isLate =
                  l.statut === "en_retard" ||
                  (l.statut === "en_cours" && new Date(l.date_retour_prevue) < new Date());

                return (
                  <tr key={l.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-navy-800 dark:text-white text-sm">{l.user_name}</p>
                      <p className="text-[11px] text-gray-400">{l.user_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-navy-800 dark:text-white">{l.titre}</p>
                      <p className="text-[11px] text-gray-400 font-mono">Cote : {l.cote || "ROM"}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      {l.code_barre || "Exemplaire #1"}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(l.date_emprunt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4">
                      <span className={isLate ? "font-bold text-rose-600" : ""}>
                        {new Date(l.date_retour_prevue).toLocaleDateString("fr-FR")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={l.statut === "retourne" ? "retourne" : isLate ? "en_retard" : "en_cours"} />
                      {isLate && (
                        <p className="text-[11px] text-rose-600 font-bold mt-1">
                          Retard : {l.jours_retard} j
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {l.statut !== "retourne" && (
                        <button
                          onClick={() => handleReturnLoan(l.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-brand hover:bg-sky-deep transition-all shadow-sm flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw size={13} /> Retourner
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucun emprunt ne correspond à ces critères.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
