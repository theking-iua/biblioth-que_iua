import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Phone,
  GraduationCap,
  X,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
  Bookmark,
  Eye,
  RefreshCcw,
  KeyRound,
  FileText,
} from "lucide-react";
import api from "../../services/api";
import { showToast } from "../../components/common/Toast";
import { useAuth } from "../../context/AuthContext";

export default function MembersManagementPage() {
  const { isAdmin, isLibrarian } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all', 'visiteur', 'adherent'
  const [showModal, setShowModal] = useState(false);
  const [selectedDossier, setSelectedDossier] = useState(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierData, setDossierData] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    nom: "",
    prenom: "",
    email: "",
    mot_de_passe: "",
    telephone: "",
    matricule: "",
    filiere: "Informatique & Génie Logiciel",
    role: "visiteur",
    statut: "actif",
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur lors du chargement des visiteurs et adhérents", "error");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (m = null) => {
    if (m) {
      setFormData({
        id: m.id,
        nom: m.nom || "",
        prenom: m.prenom || "",
        email: m.email || "",
        mot_de_passe: "",
        telephone: m.telephone || "",
        matricule: m.matricule || "",
        filiere: m.filiere || "Informatique & Génie Logiciel",
        role: m.role || "visiteur",
        statut: m.statut || "actif",
      });
    } else {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        id: null,
        nom: "",
        prenom: "",
        email: "",
        mot_de_passe: "iua" + randNum,
        telephone: "",
        matricule: "VIS-" + new Date().getFullYear() + "-" + randNum,
        filiere: "Informatique & Génie Logiciel",
        role: "visiteur",
        statut: "actif",
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.updateMember(formData);
        showToast("Compte visiteur / adhérent mis à jour avec succès !", "success");
      } else {
        await api.createMember(formData);
        showToast("Nouveau visiteur créé avec succès !", "success");
      }
      setShowModal(false);
      loadMembers();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDelete = async (id, nom) => {
    if (!confirm(`Voulez-vous vraiment supprimer le compte de ${nom || 'cet utilisateur'} ?`))
      return;
    try {
      await api.deleteMember(id);
      showToast("Compte visiteur supprimé avec succès", "info");
      loadMembers();
    } catch (err) {
      showToast(err.message || "Erreur lors de la suppression", "error");
    }
  };

  const openDossier = async (member) => {
    setSelectedDossier(member);
    setDossierLoading(true);
    try {
      const [loans, requests, reservations] = await Promise.all([
        api.getLoans({ user_id: member.id }).catch(() => []),
        api.getBorrowRequests({ user_id: member.id }).catch(() => []),
        api.getReservations({ user_id: member.id }).catch(() => []),
      ]);
      setDossierData({
        loans: Array.isArray(loans) ? loans : [],
        requests: Array.isArray(requests) ? requests : [],
        reservations: Array.isArray(reservations) ? reservations : [],
      });
    } catch (e) {
      showToast("Erreur de chargement du dossier", "error");
    } finally {
      setDossierLoading(false);
    }
  };

  const filtered = members.filter((m) => {
    const textMatch = (
      (m.nom || "") +
      " " +
      (m.prenom || "") +
      " " +
      (m.email || "") +
      " " +
      (m.matricule || "") +
      " " +
      (m.filiere || "")
    )
      .toLowerCase()
      .includes(search.toLowerCase());

    if (!textMatch) return false;
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    return true;
  });

  const totalVisitors = members.filter((m) => m.role === "visiteur").length;
  const totalAdherents = members.filter((m) => m.role === "adherent").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
              Gestion des Visiteurs & Adhérents
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              Administration IUA
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Création des comptes visiteurs, attribution des droits d'emprunt, consultation en ligne et suivi des dossiers lecteurs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <label
            title="CSV avec en-tête : nom;prenom;matricule;filiere;email;telephone — mot de passe initial = matricule"
            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-navy-600 text-navy-800 dark:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-navy-700 transition-all"
          >
            <FileText size={16} /> Importer CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const res = await api.importReaders(file);
                  showToast(res.message, res.errors?.length ? "info" : "success");
                  if (res.errors?.length) console.warn("Erreurs d'import :", res.errors);
                  loadMembers();
                } catch (err) {
                  showToast(err.message, "error");
                }
              }}
            />
          </label>
          <button
            onClick={() => openModal()}
            className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus size={16} /> Créer un Visiteur / Adhérent
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Total Comptes</span>
          <p className="font-display text-2xl font-bold text-navy-800 dark:text-white mt-1">{members.length}</p>
          <span className="text-[10px] text-sky-brand font-semibold">Tous profils confondus</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Comptes Visiteurs</span>
          <p className="font-display text-2xl font-bold text-sky-deep dark:text-sky-brand mt-1">{totalVisitors}</p>
          <span className="text-[10px] text-gray-400">Créés par l'administration</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Adhérents Étudiants</span>
          <p className="font-display text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{totalAdherents}</p>
          <span className="text-[10px] text-gray-400">Inscrits à l'IUA</span>
        </div>
        <div className="p-5 rounded-3xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Prêts en cours</span>
          <p className="font-display text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {members.reduce((acc, m) => acc + (m.loans || 0), 0)}
          </p>
          <span className="text-[10px] text-gray-400">Documents empruntés</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-5 border-b border-gray-200 dark:border-navy-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: "all", label: "Tous les profils" },
              { id: "visiteur", label: "Visiteurs uniquement" },
              { id: "adherent", label: "Adhérents étudiants" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRoleFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  roleFilter === f.id
                    ? "bg-sky-brand text-white shadow-sm"
                    : "bg-gray-100 dark:bg-navy-900 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, matricule, email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 text-xs text-navy-800 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Visiteur / Adhérent</th>
                <th className="px-6 py-4">Profil / Rôle</th>
                <th className="px-6 py-4">Matricule</th>
                <th className="px-6 py-4">Filière / Département</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Prêts Actifs</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-navy-800 dark:text-white text-sm">
                      {m.nom} {m.prenom}
                    </p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Mail size={12} /> {m.email}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        m.role === "visiteur"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                      }`}
                    >
                      {m.role === "visiteur" ? "Visiteur" : "Adhérent"}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-navy-800 dark:text-white">
                    {m.matricule || "VIS-2024-XXXX"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 font-medium text-[11px]">
                      {m.filiere || "Génie Logiciel"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" />
                      {m.telephone || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-navy-800 dark:text-white px-2 py-0.5 rounded bg-gray-100 dark:bg-navy-700">
                        {m.loans || 0} en cours
                      </span>
                      {m.late_loans > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          {m.late_loans} retard
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        m.statut === "suspendu"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }`}
                    >
                      {m.statut === "suspendu" ? "Suspendu" : "Actif"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openDossier(m)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-navy-700 transition-colors"
                        title="Consulter le dossier d'emprunts"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openModal(m)}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700 transition-colors"
                        title="Modifier les identifiants"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.nom)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-navy-700 transition-colors"
                        title="Supprimer ce compte"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="p-12 text-center text-xs text-gray-500">
              Aucun visiteur ou adhérent trouvé.
            </div>
          )}
        </div>
      </div>

      {/* Modal Créer / Modifier Visiteur */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                  {formData.id ? "Modifier le Compte Visiteur" : "Créer un Compte Visiteur / Lecteur"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  L'administrateur attribue les identifiants de connexion et autorisations IUA.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Ex: CISSE"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Prénom(s)</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    placeholder="Ex: Ismaël"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Adresse Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="visiteur@iua.ci"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Matricule IUA</label>
                  <input
                    type="text"
                    value={formData.matricule}
                    onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                    placeholder="VIS-2024-XXXX"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    placeholder="+225 07..."
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Type de Compte</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  >
                    <option value="visiteur">Visiteur / Lecteur</option>
                    <option value="adherent">Adhérent Étudiant</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Statut du compte</label>
                  <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  >
                    <option value="actif">Actif (autorisé)</option>
                    <option value="suspendu">Suspendu (bloqué)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Filière / Organisme d'origine</label>
                <input
                  type="text"
                  value={formData.filiere}
                  onChange={(e) => setFormData({ ...formData, filiere: e.target.value })}
                  placeholder="Informatique & Génie Logiciel"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">
                  {formData.id ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe initial *"}
                </label>
                <input
                  type="text"
                  required={!formData.id}
                  value={formData.mot_de_passe}
                  onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
                  placeholder="Mot de passe confidentiel"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-500 bg-gray-100 dark:bg-navy-700 hover:bg-gray-200 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold shadow-md"
                >
                  {formData.id ? "Enregistrer les modifications" : "Créer le Visiteur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dossier Lecteur */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                  Dossier Lecteur : {selectedDossier.nom} {selectedDossier.prenom}
                </h2>
                <p className="text-xs text-sky-brand font-semibold mt-0.5">
                  Matricule : {selectedDossier.matricule || "N/A"} • {selectedDossier.email}
                </p>
              </div>
              <button onClick={() => setSelectedDossier(null)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {dossierLoading ? (
              <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <RefreshCcw className="animate-spin" size={16} /> Chargement du dossier en cours...
              </div>
            ) : dossierData ? (
              <div className="space-y-4 text-xs">
                {/* Emprunts */}
                <div>
                  <h3 className="font-bold text-navy-800 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                    <Bookmark size={14} className="text-sky-brand" />
                    Emprunts en cours ({dossierData.loans.filter((l) => l.statut !== "retourne").length})
                  </h3>
                  {dossierData.loans.filter((l) => l.statut !== "retourne").length === 0 ? (
                    <p className="text-gray-400 italic">Aucun emprunt actif.</p>
                  ) : (
                    <div className="space-y-2">
                      {dossierData.loans
                        .filter((l) => l.statut !== "retourne")
                        .map((l) => (
                          <div
                            key={l.id}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700 flex justify-between items-center"
                          >
                            <div>
                              <strong className="text-navy-800 dark:text-white">{l.titre}</strong>
                              <p className="text-[11px] text-gray-400">
                                Date limite : {new Date(l.date_retour_prevue).toLocaleDateString("fr-FR")}
                              </p>
                            </div>
                            <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-navy-700 dark:text-sky-300">
                              {l.statut}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Réservations */}
                <div className="pt-2 border-t border-gray-100 dark:border-navy-700">
                  <h3 className="font-bold text-navy-800 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Réservations en file ({dossierData.reservations.length})
                  </h3>
                  {dossierData.reservations.length === 0 ? (
                    <p className="text-gray-400 italic">Aucune réservation.</p>
                  ) : (
                    <div className="space-y-2">
                      {dossierData.reservations.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-100 dark:border-navy-700 flex justify-between items-center"
                        >
                          <div>
                            <strong className="text-navy-800 dark:text-white">{r.titre}</strong>
                            <p className="text-[11px] text-gray-400">Rang dans la file : #{r.rang_file}</p>
                          </div>
                          <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {r.statut}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-navy-700">
              <button
                onClick={() => setSelectedDossier(null)}
                className="px-5 py-2.5 rounded-xl bg-navy-800 dark:bg-sky-brand text-white font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
