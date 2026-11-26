import React, { useState, useEffect } from "react";
import { GraduationCap, Plus, Search, Edit, Trash2, Download, Eye, X, Award, FileText } from "lucide-react";
import api from "../../services/api";
import { showToast } from "../../components/common/Toast";

export default function DigitalResourcesAdminPage() {
  const [theses, setTheses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    titre: "",
    auteur: "",
    directeur_recherche: "",
    filiere: "Informatique & Génie Logiciel",
    cycle: "Master",
    annee_academique: "2023-2024",
    session_soutenance: "Session de Juillet",
    note_mention: "Très Bien (17/20)",
    resume: "",
    mots_cles: "",
    telechargeable: 1,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getDigitalResources();
      setTheses(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast("Erreur lors de la récupération des ressources", "error");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (t = null) => {
    if (t) {
      setFormData({ ...t });
    } else {
      setFormData({
        id: null,
        titre: "",
        auteur: "",
        directeur_recherche: "",
        filiere: "Informatique & Génie Logiciel",
        cycle: "Master",
        annee_academique: "2023-2024",
        session_soutenance: "Session de Septembre",
        note_mention: "Très Bien",
        resume: "",
        mots_cles: "",
        telechargeable: 1,
        fichier_path: "",
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.updateDigitalResource(formData);
        showToast("Mémoire mis à jour avec succès !", "success");
      } else {
        await api.createDigitalResource(formData);
        showToast("Nouveau mémoire déposé au catalogue !", "success");
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur lors de l'enregistrement", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce mémoire du dépôt numérique ?")) return;
    try {
      await api.deleteDigitalResource(id);
      showToast("Mémoire retiré", "info");
      loadData();
    } catch (err) {
      showToast(err.message || "Erreur", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-800 dark:text-white">
            Dépôt Numérique des Mémoires & Thèses
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Publication et archivage institutionnel des sujets et travaux de recherche d'excellence de l'IUA.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-5 py-2.5 rounded-xl bg-sky-brand hover:bg-sky-deep text-white text-xs font-bold uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <Plus size={16} /> Déposer un mémoire
        </button>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-3xl border border-gray-200 dark:border-navy-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-navy-700">
              <tr>
                <th className="px-6 py-4">Sujet / Titre</th>
                <th className="px-6 py-4">Auteur & Encadreur</th>
                <th className="px-6 py-4">Filière & Cycle</th>
                <th className="px-6 py-4">Session / Mention</th>
                <th className="px-6 py-4">Vues / Téléch.</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-700/60 text-gray-600 dark:text-gray-300">
              {theses.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60 dark:hover:bg-navy-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-navy-800 dark:text-white text-sm max-w-sm line-clamp-2">
                      {t.titre}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-navy-800 dark:text-white">{t.auteur}</p>
                    <p className="text-[11px] text-gray-400">Dir : {t.directeur_recherche || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-navy-800 dark:text-white block">{t.filiere}</span>
                    <span className="text-[11px] text-sky-deep dark:text-sky-brand font-medium">{t.cycle}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">{t.note_mention}</span>
                    <span className="text-[11px] text-gray-400">{t.session_soutenance}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-500">
                    <span className="flex items-center gap-1"><Eye size={12} /> {t.nb_vues || 0}</span>
                    <span className="flex items-center gap-1 mt-0.5"><Download size={12} /> {t.nb_telechargements || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(t)}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-navy-700"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-navy-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-gray-200 dark:border-navy-700 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-3">
              <h3 className="font-display text-lg font-bold text-navy-800 dark:text-white">
                {formData.id ? "Modifier le Mémoire" : "Déposer un Mémoire de Soutenance"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Sujet / Titre complet du mémoire *</label>
                <input
                  type="text"
                  required
                  value={formData.titre}
                  onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Nom de l'étudiant / candidat *</label>
                  <input
                    type="text"
                    required
                    value={formData.auteur}
                    onChange={(e) => setFormData({ ...formData, auteur: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Directeur de recherche</label>
                  <input
                    type="text"
                    placeholder="Dr. / Pr. Nom"
                    value={formData.directeur_recherche}
                    onChange={(e) => setFormData({ ...formData, directeur_recherche: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Filière académique</label>
                  <select
                    value={formData.filiere}
                    onChange={(e) => setFormData({ ...formData, filiere: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  >
                    <option value="Informatique & Génie Logiciel">Informatique & Génie Logiciel</option>
                    <option value="Réseaux & Cybersécurité">Réseaux & Cybersécurité</option>
                    <option value="Droit Privé & Droit des Affaires">Droit Privé & Droit des Affaires</option>
                    <option value="Droit Public & Relations Internationales">Droit Public & Relations Internationales</option>
                    <option value="Finance, Banque & Assurance">Finance, Banque & Assurance</option>
                    <option value="Sciences Économiques & Gestion">Sciences Économiques & Gestion</option>
                    <option value="Marketing, Commerce & Communication">Marketing, Commerce & Communication</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cycle</label>
                  <select
                    value={formData.cycle}
                    onChange={(e) => setFormData({ ...formData, cycle: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  >
                    <option value="Licence">Licence</option>
                    <option value="Master">Master</option>
                    <option value="Doctorat">Doctorat</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Année académique</label>
                  <input
                    type="text"
                    value={formData.annee_academique}
                    onChange={(e) => setFormData({ ...formData, annee_academique: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Session de soutenance</label>
                  <input
                    type="text"
                    value={formData.session_soutenance}
                    onChange={(e) => setFormData({ ...formData, session_soutenance: e.target.value })}
                    placeholder="Ex: Session de Juillet 2024"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Mention / Note</label>
                  <input
                    type="text"
                    value={formData.note_mention}
                    onChange={(e) => setFormData({ ...formData, note_mention: e.target.value })}
                    placeholder="Ex: Mention Très Bien (17/20)"
                    className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Résumé analytique</label>
                <textarea
                  rows="3"
                  value={formData.resume}
                  onChange={(e) => setFormData({ ...formData, resume: e.target.value })}
                  placeholder="Problématique, méthodologie et résultats majeurs..."
                  className="w-full p-3 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mots-clés</label>
                <input
                  type="text"
                  value={formData.mots_cles}
                  onChange={(e) => setFormData({ ...formData, mots_cles: e.target.value })}
                  placeholder="sécurité, cryptographie, OHADA..."
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Fichier PDF du mémoire</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      showToast("Envoi du PDF en cours...", "info");
                      const res = await api.uploadMemoirePdf(file);
                      setFormData((f) => ({ ...f, fichier_path: res.fichier_path }));
                      showToast("PDF déposé. Pensez à enregistrer la fiche.", "success");
                    } catch (err) {
                      showToast(err.message, "error");
                    }
                  }}
                  className="w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-sky-brand file:text-white file:font-bold"
                />
                {formData.fichier_path && (
                  <span className="text-[11px] text-gray-500 mt-1 block">Fichier actuel : {formData.fichier_path}</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 bg-gray-100 dark:bg-navy-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-brand hover:bg-sky-deep text-white font-bold"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
