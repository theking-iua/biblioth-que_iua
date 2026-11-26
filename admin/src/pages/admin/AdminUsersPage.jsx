import React, { useState, useEffect } from "react";
import { User, Plus, Search, Edit, Trash2, ShieldCheck, Mail, Calendar, X, ChevronDown } from "lucide-react";
import api from "../../services/api";
import { showToast } from "../../components/common/Toast";

const ROLE_META = {
  admin:         { label: "Administrateur",  cls: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200" },
  bibliothecaire:{ label: "Bibliothécaire",  cls: "bg-sky-100 dark:bg-navy-700 text-sky-700 dark:text-sky-300 border border-sky-200" },
  visiteur:      { label: "Visiteur",        cls: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200" },
  adherent:      { label: "Adhérent",        cls: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200" },
};

const isReaderRole = (role) => role === "visiteur" || role === "adherent";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    nom: "",
    prenom: "",
    email: "",
    role: "bibliothecaire",
    mot_de_passe: "",
    matricule: "",
    telephone: "",
    filiere: "",
    statut: "actif",
  });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur lors de la récupération des comptes", "error");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (u = null) => {
    if (u) {
      setFormData({
        id: u.id,
        nom: u.nom || "",
        prenom: u.prenom || "",
        email: u.email || "",
        role: u.role || "bibliothecaire",
        mot_de_passe: "",
        matricule: u.matricule || "",
        telephone: u.telephone || "",
        filiere: u.filiere || "",
        statut: u.statut || "actif",
      });
    } else {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setFormData({
        id: null,
        nom: "",
        prenom: "",
        email: "",
        role: "bibliothecaire",
        mot_de_passe: "",
        matricule: "VIS-" + new Date().getFullYear() + "-" + randNum,
        telephone: "",
        filiere: "",
        statut: "actif",
      });
    }
    setShowModal(true);
  };

  const handleRoleChange = (role) => {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({
      ...prev,
      role,
      matricule: isReaderRole(role)
        ? "VIS-" + new Date().getFullYear() + "-" + randNum
        : "",
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.updateAdminUser(formData);
        showToast("Compte utilisateur mis à jour !", "success");
      } else {
        await api.createAdminUser(formData);
        showToast("Nouveau compte créé avec succès !", "success");
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer définitivement cet utilisateur ?")) return;
    try {
      await api.deleteAdminUser(id);
      showToast("Utilisateur supprimé", "info");
      loadUsers();
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  };

  const filtered = users.filter((u) =>
    ((u.nom || "") + " " + (u.email || "") + " " + (u.role || ""))
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
            Gestion des Comptes Utilisateurs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Créez et gérez tous les comptes : administrateurs, bibliothécaires, visiteurs et adhérents.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus size={16} /> Nouveau Compte Utilisateur
        </button>
      </div>

      {/* KPI par rôle */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.entries(ROLE_META).map(([role, meta]) => (
          <div key={role} className="p-4 rounded-2xl bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">{meta.label}s</p>
            <p className="font-display text-2xl font-bold text-navy-800 dark:text-white mt-1">
              {users.filter((u) => u.role === role).length}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        {/* Barre recherche */}
        <div className="p-4 border-b border-gray-100 dark:border-navy-700 flex items-center gap-3">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, rôle..."
            className="w-full bg-transparent text-xs text-navy-800 dark:text-white outline-none placeholder-gray-400"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Nom</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Rôle attribué</th>
                <th className="px-6 py-4">Date de création</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {filtered.map((u) => {
                const meta = ROLE_META[u.role] || ROLE_META.bibliothecaire;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-navy-800 dark:text-white">{u.nom}</td>
                    <td className="px-6 py-4">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.date_creation ? new Date(u.date_creation).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(u)}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700"
                          title="Modifier"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-navy-700"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Créer / Modifier */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                  {formData.id ? "Modifier le compte" : "Créer un compte Utilisateur"}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Choisissez le rôle pour adapter les champs du formulaire.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">

              {/* Sélecteur de rôle — en haut, bien visible */}
              <div>
                <label className="block font-bold mb-1.5 text-navy-800 dark:text-gray-200 text-xs uppercase tracking-wider">
                  Type de compte *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_META).map(([role, meta]) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                        formData.role === role
                          ? "bg-sky-brand text-white border-sky-brand shadow-md"
                          : "bg-gray-50 dark:bg-navy-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-navy-700 hover:border-sky-brand/50"
                      }`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom + Prénom */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Nom *</label>
                  <input
                    type="text" required value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Ex: KONE"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Prénom</label>
                  <input
                    type="text" value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    placeholder="Ex: Aminata"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Email *</label>
                <input
                  type="email" required value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="utilisateur@iua.ci"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              {/* Champs supplémentaires pour Visiteur / Adhérent */}
              {isReaderRole(formData.role) && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Matricule IUA</label>
                      <input
                        type="text" value={formData.matricule}
                        onChange={(e) => setFormData({ ...formData, matricule: e.target.value })}
                        placeholder="VIS-2026-XXXX"
                        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Téléphone</label>
                      <input
                        type="tel" value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="+225 07..."
                        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">Filière / Département</label>
                    <input
                      type="text" value={formData.filiere}
                      onChange={(e) => setFormData({ ...formData, filiere: e.target.value })}
                      placeholder="Ex: Informatique & Génie Logiciel"
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                    />
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
                </>
              )}

              {/* Mot de passe */}
              <div>
                <label className="block font-semibold mb-1 text-navy-800 dark:text-gray-200">
                  {formData.id ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe initial *"}
                </label>
                <input
                  type={isReaderRole(formData.role) ? "text" : "password"}
                  required={!formData.id}
                  placeholder={isReaderRole(formData.role) ? "Ex: iua1234" : "••••••••"}
                  value={formData.mot_de_passe}
                  onChange={(e) => setFormData({ ...formData, mot_de_passe: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 bg-gray-100 dark:bg-navy-700 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold shadow-md"
                >
                  {formData.id ? "Enregistrer" : "Créer l'utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
